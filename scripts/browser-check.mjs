import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const edge = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : existsSync(edge) ? {executablePath:edge} : {})});
const context = await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
const page = await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',msg=>{if(msg.type()==='error') errors.push(msg.text());});
mkdirSync('artifacts',{recursive:true});
const results=[];
const presentation={};
await page.addInitScript(()=>{
  const fixture=sessionStorage.getItem('stardust-browser-fixture');
  if(fixture!==null){localStorage.setItem('stardust-to-civilization:normal:v1',fixture);sessionStorage.removeItem('stardust-browser-fixture');}
});
async function reloadWithState(state, age=0) {
  // Apply an isolated fixture after the previous page has completed its lifecycle saves.
  await page.evaluate(({state,age})=>{const now=Date.now()-age*1000;sessionStorage.setItem('stardust-browser-fixture',typeof state==='string'?state:JSON.stringify({version:state.version,savedAt:now,state:{...state,lastSaved:now}}));},{state,age});
  await page.reload();
}

async function section(name) {
  await page.getByRole('tab',{name,exact:true}).click();
}

async function revealControl(name, sectionName) {
  if(sectionName) await section(sectionName);
  // Inspect the object through the same compact picker a player uses. The complete
  // catalogs remain a fallback for controls that live in World disclosures.
  if(typeof name==='string'&&/^(Build|Unlock|Improve) /.test(name)) {
    const label=`Inspect ${name.replace(/^(Build|Unlock|Improve) /,'')}`;
    const inspect=page.locator('.object-picker').getByRole('button',{name:label,exact:true});
    if(await inspect.count()) await inspect.click();
    else {
      const mapNode=page.locator('.evolution-map').getByRole('button',{name:label,exact:true});
      if(await mapNode.count()) await mapNode.click();
    }
  }
  const control=page.getByRole('button',{name,exact:true,includeHidden:true}).first();
  await control.waitFor({state:'attached'});
  // Open disclosures with the same keyboard/touch-accessible summaries players use.
  const ancestors=await control.locator('xpath=ancestor::details').all();
  for(const detail of ancestors) {
    if(!await detail.evaluate(node=>node.open)) await detail.locator(':scope > summary').click();
  }
  await control.waitFor({state:'visible'});
  return control;
}

async function storedState(slot='normal') {
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  return page.evaluate(slot=>JSON.parse(localStorage.getItem(`stardust-to-civilization:${slot}:v1`)).state,slot);
}

function unchangedPurchases(before,after,message) {
  for(const key of ['buildings','upgrades','automation']) assert.deepEqual(after[key],before[key],`${message}: ${key}`);
  assert.equal(after.stats.taps,before.stats.taps,`${message}: selection does not gather`);
}

async function purchase(name, sectionName) {
  await (await revealControl(name,sectionName)).click();
}

async function revealCard(id) {
  const card=page.locator(`[data-card-id="${id}"]`);
  await card.waitFor({state:'attached'});
  for(const detail of await card.locator('xpath=ancestor::details').all()) {
    if(!await detail.evaluate(node=>node.open)) await detail.locator(':scope > summary').click();
  }
  await card.waitFor({state:'visible'});
  return card;
}

async function openDetails(label) {
  const summary=page.locator('summary').filter({hasText:label}).first();
  await summary.waitFor({state:'attached'});
  for(const detail of await summary.locator('xpath=ancestor::details').all()) {
    if(!await detail.evaluate(node=>node.open)) await detail.locator(':scope > summary').click();
  }
  await summary.waitFor({state:'visible'});
  if(!await summary.locator('..').evaluate(node=>node.open)) await summary.click();
}

async function chapter(name) {
  await page.getByRole('navigation',{name:'Game chapters'}).getByRole('button',{name,exact:true}).click();
}

async function checkNavigationLocal(viewport) {
  const navigation=page.getByRole('navigation',{name:'Game chapters'});
  const actionTabs=page.getByRole('tablist',{name:'Game actions'});
  const chapterDocumentTop=await navigation.evaluate(node=>node.getBoundingClientRect().top+scrollY);
  assert.equal(await actionTabs.evaluate(tabs=>tabs.parentElement.matches('.action-area')&&tabs.nextElementSibling.matches('.action-panel')),true,`${viewport}: Action tabs belong directly above their controls`);
  for(const [label,control] of [['Chapter navigation',navigation],['Action tabs',actionTabs]]) {
    const pinnedAncestor=await control.evaluate(node=>{
      for(let current=node;current;current=current.parentElement) {
        if(['fixed','sticky'].includes(getComputedStyle(current).position)) return true;
      }
      return false;
    });
    assert.equal(pinnedAncestor,false,`${viewport}: ${label} scrolls naturally without a pinned toolbar`);
  }
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const scrolledChapterDocumentTop=await navigation.evaluate(node=>node.getBoundingClientRect().top+scrollY);
  assert.ok(Math.abs(chapterDocumentTop-scrolledChapterDocumentTop)<1,`${viewport}: Chapter navigation retains its document position while scrolling`);
  await actionTabs.evaluate(node=>node.scrollIntoView({block:'center'}));
  const selected=await actionTabs.getByRole('tab',{selected:true}).innerText();
  const build=actionTabs.getByRole('tab',{name:'Build',exact:true});
  const usable=await build.evaluate(tab=>{
    const box=tab.getBoundingClientRect();
    return box.height>=40&&tab.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
  });
  assert.equal(usable,true,`${viewport}: Local action tabs provide visible, unobstructed touch targets`);
  await build.click();
  assert.equal(await build.getAttribute('aria-selected'),'true',`${viewport}: Local tabs still switch their action panel`);
  await section(selected);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${viewport}: Local navigation has no horizontal overflow`);
  await page.screenshot({path:`artifacts/${viewport.toLowerCase()}-action-navigation.png`});
  await page.evaluate(()=>window.scrollTo(0,0));
  results.push(`${viewport}: Action tabs sit above their controls, scroll naturally, and remain touch usable`);
}

async function checkGatherConsistency(viewport) {
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const tapsBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:developer:v1')).state.stats.taps);
  let baseline;
  for(const chapter of ['The cosmos','Living world','Civilization']) {
    await page.getByRole('navigation',{name:'Game chapters'}).getByRole('button',{name:chapter,exact:true}).click();
    assert.deepEqual(await page.getByRole('tablist',{name:'Game actions'}).getByRole('tab').allTextContents(),['Build','Research','World'],`${viewport}: Action labels stay consistent in ${chapter}`);
    const gather=page.getByRole('button',{name:'Gather hydrogen',exact:true});
    const appearance=await gather.evaluate(button=>{
      const style=getComputedStyle(button);
      const label=button.querySelector('strong');
      const yieldText=button.querySelector('small');
      const shortcut=button.querySelector('kbd');
      const size=button.getBoundingClientRect();
      return {
        width:Number(size.width.toFixed(2)),height:Number(size.height.toFixed(2)),
        background:style.backgroundColor,color:style.color,border:style.borderColor,
        radius:style.borderRadius,padding:style.padding,shadow:style.boxShadow,
        label:label.textContent,labelSize:getComputedStyle(label).fontSize,
        yield:yieldText.textContent,yieldSize:getComputedStyle(yieldText).fontSize,
        yieldDisplay:getComputedStyle(yieldText).display,shortcutDisplay:getComputedStyle(shortcut).display,
        labelLayout:getComputedStyle(label.parentElement).flexDirection,
        icons:[...button.querySelectorAll(':scope > svg')].map(icon=>({width:getComputedStyle(icon).width,height:getComputedStyle(icon).height,display:getComputedStyle(icon).display})),
        firstInRow:button.parentElement.firstElementChild===button,
      };
    });
    assert.equal(appearance.firstInRow,true,`${viewport}: Gather stays first in ${chapter}`);
    assert.notEqual(appearance.yieldDisplay,'none',`${viewport}: Tap yield stays visible in ${chapter}`);
    assert.notEqual(appearance.shortcutDisplay,'none',`${viewport}: Keyboard shortcut stays visible in ${chapter}`);
    if(baseline) assert.deepEqual(appearance,baseline,`${viewport}: Gather keeps the same appearance in ${chapter}`);
    else baseline=appearance;
    await gather.click();
    await page.keyboard.press('h');
  }
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const tapsAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:developer:v1')).state.stats.taps);
  assert.equal(tapsAfter-tapsBefore,6,`${viewport}: Tapping and H gather in every chapter`);
  presentation[`${viewport}GatherSize`]={width:baseline.width,height:baseline.height};
  results.push(`${viewport}: Gather appearance, tap yield, shortcut and input stay consistent across all three chapters`);
  await page.evaluate(()=>window.scrollTo(0,0));
}

async function checkEvolutionSelection(viewport) {
  await section('Research');
  const map=page.getByRole('region',{name:'Evolution web',exact:true});
  await map.waitFor({state:'visible'});
  assert.equal(await map.locator('[data-evolution-node]').count(),10,`${viewport}: The evolution web retains every major lineage`);
  assert.ok(await map.locator('[data-edge-kind="ancestry"]').count()>0,`${viewport}: Ancestral connections are visible`);
  assert.ok(await map.locator('[data-edge-kind="support"]').count()>0,`${viewport}: Ecological-support connections are visible`);
  const ancestryDash=await map.locator('.evolution-map__ancestry').first().evaluate(node=>getComputedStyle(node).strokeDasharray);
  const supportDash=await map.locator('.evolution-map__support').first().evaluate(node=>getComputedStyle(node).strokeDasharray);
  assert.notEqual(ancestryDash,supportDash,`${viewport}: Ecological support and ancestry use different line styles`);
  await map.screenshot({path:`artifacts/${viewport.toLowerCase()}-evolution-map.png`});
  const before=await storedState('developer');
  const humans=map.getByRole('button',{name:'Inspect Human communities',exact:true});
  await humans.focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-card-id="humans"]').waitFor({state:'visible'});
  assert.equal(await humans.getAttribute('aria-pressed'),'true',`${viewport}: Keyboard selection marks the inspected lineage`);
  assert.equal(await page.getByRole('button',{name:'Unlock Human communities',exact:true}).isDisabled(),true,`${viewport}: Inspecting humans cannot bypass ancestors or ecosystem prerequisites`);
  unchangedPurchases(before,await storedState('developer'),`${viewport}: Evolution node selection is free`);
  const humanBounds=await humans.boundingBox();
  assert.ok(humanBounds&&humanBounds.width>=44&&humanBounds.height>=44,`${viewport}: Evolution nodes have usable touch targets`);
  results.push(`${viewport}: Evolution web selects actual research with keyboard support, distinct ancestry/support edges, and enforced prerequisites`);
}

async function checkBiosphereScenery(state) {
  const healthyGrass=await page.locator('.scene-art linearGradient[id$="-grass"] stop').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('stop-color')));
  assert.equal(await page.locator('[data-scene-effect="industrial-haze"]').count(),0,'A healthy settlement has no biosphere-pressure haze');
  // This isolated low-health fixture checks presentation; the legal journey separately
  // proves that the economy and final objective are reachable without such fixtures.
  const pressureContext=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
  try {
    await pressureContext.addInitScript(state=>{
      const now=Date.now();
      localStorage.setItem('stardust-to-civilization:normal:v1',JSON.stringify({version:state.version,savedAt:now,state:{...state,health:25,lastSaved:now}}));
    },state);
    const pressurePage=await pressureContext.newPage();
    pressurePage.on('pageerror',error=>errors.push(String(error)));
    await pressurePage.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');
    await pressurePage.locator('.playable-scene.scene-under-pressure').waitFor({state:'visible'});
    const haze=pressurePage.locator('[data-scene-effect="industrial-haze"]');
    await haze.waitFor({state:'visible'});
    assert.ok(Number(await haze.getAttribute('opacity'))>0,'Low biosphere health adds visible settlement haze');
    const pressuredGrass=await pressurePage.locator('.scene-art linearGradient[id$="-grass"] stop').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('stop-color')));
    assert.notDeepEqual(pressuredGrass,healthyGrass,'Vegetation colors respond to biosphere pressure');
    await pressurePage.screenshot({path:'artifacts/desktop-biosphere-pressure.png',fullPage:true});
    results.push('Isolated biosphere-pressure scenery shows changed vegetation and haze without altering the normal or developer game');
  } finally { await pressureContext.close(); }
}

async function checkBiosphereInspector(viewport) {
  await section('Build');
  const before=await storedState('developer');
  await page.locator('.world-card').getByRole('button',{name:/^Biosphere health /}).click();
  const care=page.locator('[data-card-id="biosphere-inspector"]');
  await care.waitFor({state:'visible'});
  assert.equal(await page.getByRole('tab',{name:'World',exact:true}).getAttribute('aria-selected'),'true',`${viewport}: Scene health opens the World care inspector`);
  unchangedPurchases(before,await storedState('developer'),`${viewport}: Inspecting biosphere health does not purchase or gather`);
  const health=Number(await page.locator('.playable-scene').getAttribute('data-health'));
  await care.getByRole('button',{name:'Restore biosphere · free',exact:true}).click();
  const restored=await storedState('developer');
  assert.ok(restored.health>health,`${viewport}: The care inspector performs ordinary free restoration`);
  unchangedPurchases(before,restored,`${viewport}: Free restoration does not buy anything`);
  await care.getByRole('button',{name:'Planetary conditions',exact:true}).click();
  await page.locator('[data-card-id="planet-environment"]').waitFor({state:'visible'});
  results.push(`${viewport}: Selecting biosphere health opens a working free-restoration inspector and links to planetary conditions`);
}

try {
  page.setDefaultTimeout(10000);
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'Gather hydrogen',exact:true}).waitFor();
  presentation.freshVisibleWords=await page.evaluate(()=>document.body.innerText.trim().split(/\s+/).length);
  presentation.freshVisiblePurchaseCards=await page.locator('.purchase-card:visible').count();
  assert.ok(presentation.freshVisibleWords<=250,`Fresh game stays compact (${presentation.freshVisibleWords} visible words)`);
  assert.ok(presentation.freshVisiblePurchaseCards<=3,`Fresh game prioritizes near-term actions (${presentation.freshVisiblePurchaseCards} visible purchase cards)`);
  const playableWorld=page.locator('.world-card');
  await playableWorld.locator('.playable-scene').waitFor({state:'visible'});
  await playableWorld.locator('.scene-gather.is-guided').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true,'Browser verification exercises reduced motion');
  const movingSceneObjects=await playableWorld.locator('.playable-scene *').evaluateAll(nodes=>nodes.filter(node=>{
    const style=getComputedStyle(node);
    return style.animationName!=='none'&&style.animationDuration.split(',').some(value=>parseFloat(value)>.01);
  }).map(node=>node.getAttribute('class')));
  assert.deepEqual(movingSceneObjects,[],'Reduced motion preserves the scene without ongoing decorative animation');
  const desktopWorld=await playableWorld.boundingBox();
  const desktopInspector=await page.locator('.action-area').boundingBox();
  assert.ok(desktopWorld&&desktopInspector&&desktopWorld.width>desktopInspector.width,'Desktop gives the playable world more space than its inspector');
  const beforeInspect=await storedState();
  await playableWorld.getByRole('button',{name:'Inspect Gas collector',exact:true}).click();
  await page.locator('[data-card-id="collector"]').waitFor({state:'visible'});
  const afterInspect=await storedState();
  unchangedPurchases(beforeInspect,afterInspect,'Inspecting a scene object is free');
  assert.deepEqual(afterInspect.resources,beforeInspect.resources,'Selecting an object does not award or spend resources');
  assert.equal(await page.locator('.purchase-card:visible').count(),1,'The selected object has one visible purchase inspector');
  results.push('Large playable world, free object selection, and a single contextual purchase inspector');
  assert.equal(await page.locator('.science-note p:visible').count(),0,'Long science explanations start collapsed');
  assert.equal(await page.locator('.history-card ol:visible').count(),0,'History starts collapsed');
  const learningPanel=page.locator('.next-milestone');
  await learningPanel.locator('.learning-lesson').waitFor({state:'visible'});
  assert.ok((await learningPanel.locator('.learning-lesson').innerText()).trim().length>0,'The current step explains the mechanic it teaches');
  assert.ok((await learningPanel.locator('.learning-chapter').innerText()).trim().length>0,'The current step names its larger chapter');
  const learningRoute=learningPanel.locator('details.learning-route');
  assert.equal(await learningRoute.evaluate(node=>node.open),false,'Upcoming learning steps begin collapsed');
  await learningRoute.locator(':scope > summary').click();
  assert.ok(await learningRoute.locator('li').count()>=2,'Players can inspect several upcoming steps without changing progress');
  await learningRoute.locator(':scope > summary').click();
  const gatheringStep=await learningPanel.locator('h2').innerText();
  results.push(`Compact fresh screen: ${presentation.freshVisibleWords} visible words and ${presentation.freshVisiblePurchaseCards} purchase cards`);
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const beforeGuidance=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state);
  await section('World');
  const freshGuide=page.getByRole('button',{name:'Show next step',exact:true});
  assert.equal(await freshGuide.isEnabled(),true,'Guidance remains available before its purchase is affordable');
  await freshGuide.click();
  assert.equal(await page.getByRole('tab',{name:'Build',exact:true}).getAttribute('aria-selected'),'true','Fresh guidance selects the first action view');
  const guidedGather=page.locator('[data-card-id="gather-hydrogen"].guided-target');
  await guidedGather.waitFor({state:'visible'});
  assert.equal(await guidedGather.evaluate(button=>button===document.activeElement),true,'The first learning step focuses the hydrogen gathering control');
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const afterGuidance=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state);
  for(const key of ['resources','buildings','upgrades','stats','automation']) {
    assert.deepEqual(afterGuidance[key],beforeGuidance[key],`Show next step leaves ${key} unchanged`);
  }
  assert.equal(await page.getByRole('button',{name:'Build Gas collector',exact:true}).isDisabled(),true,'Guidance does not buy or fund an unaffordable collector');
  results.push('Learning starts with gathering, offers a collapsed route preview, and guides without changing the economy');
  await page.getByRole('tab',{name:'Build',exact:true}).focus();
  for(const [key,name] of [['ArrowRight','Research'],['ArrowLeft','Build'],['End','World'],['Home','Build']]) {
    await page.keyboard.press(key);
    const tab=page.getByRole('tab',{name,exact:true});
    assert.equal(await tab.getAttribute('aria-selected'),'true',`${key} selects ${name}`);
    assert.equal(await tab.evaluate(node=>node===document.activeElement),true,`${key} keeps keyboard focus on ${name} after guidance`);
  }
  results.push('Keyboard arrow, Home and End navigation retains tab focus after a guided next step');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'artifacts/desktop-cosmos.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Desktop has no overflow');
  await playableWorld.getByRole('button',{name:'Gather hydrogen from cloud',exact:true}).click();
  await playableWorld.getByRole('button',{name:'Gather hydrogen from cloud',exact:true}).focus();
  await page.keyboard.press('Enter');
  for(let n=0;n<12;n++) await page.getByRole('button',{name:'Gather hydrogen',exact:true}).click();
  assert.equal(await learningPanel.locator('h2').innerText(),gatheringStep,'The first learning step stays current until its real resource threshold');
  await page.getByRole('button',{name:'Gather hydrogen',exact:true}).click();
  const collectorStep=await learningPanel.locator('h2').innerText();
  assert.notEqual(collectorStep,gatheringStep,'Gathering 15 hydrogen advances to the collector lesson');
  await section('World');
  await page.getByRole('button',{name:'Show next step',exact:true}).click();
  const guidedCollector=page.locator('[data-card-id="collector"].guided-target');
  await guidedCollector.waitFor({state:'visible'});
  assert.equal(await guidedCollector.evaluate(card=>card===document.activeElement||card.contains(document.activeElement)),true,'The next learning step focuses the collector purchase');
  await purchase('Build Gas collector','Build');
  await playableWorld.locator('[data-scene-object="collector"][data-owned="1"]').waitFor({state:'visible'});
  const collectorTarget=await playableWorld.getByRole('button',{name:'Inspect Gas collector',exact:true}).boundingBox();
  assert.ok(collectorTarget&&collectorTarget.width>=44&&collectorTarget.height>=44,'Scene collectors provide usable touch targets');
  results.push('Cloud pointer and keyboard gathering use ordinary taps; a purchased collector becomes visibly owned');
  assert.notEqual(await learningPanel.locator('h2').innerText(),collectorStep,'A real collector purchase advances to another small production step');
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')));
  assert.equal(saved.version,2,'Current saves use the expanded schema while retaining the original slot key');
  assert.equal(saved.state.buildings.collector,1);
  assert.equal(saved.state.stats.taps,15);
  await page.reload();
  await page.getByRole('button',{name:'Gather hydrogen',exact:true}).waitFor();
  await page.keyboard.press('h');
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state.stats.taps),16);
  console.log('Check passed');
  results.push('Normal gathering, collector purchase, keyboard input, manual save and reload');
  results.push('Real gathering and a validated purchase advance separate learning steps before star formation');
  await (await revealControl('Reset progress')).click();
  await page.getByRole('button',{name:'Keep exploring',exact:true}).click();
  console.log('Check passed');
  results.push('Reset confirmation can be canceled');
  await page.getByRole('button',{name:/^Hydrogen/}).click();
  await page.getByText('Gathered from space; feeds gas clouds, stars, water, and prebiotic chemistry.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Close resource information'}).click();
  console.log('Check passed');
  results.push('Touch-accessible resource explanations');
  await page.clock.install();
  // Changing action tabs and reopening explanations must not affect elapsed production.
  await reloadWithState(saved.state);
  const workingCollector=playableWorld.getByRole('button',{name:'Inspect Gas collector',exact:true});
  await workingCollector.focus();
  await page.clock.fastForward(5000);
  assert.equal(await workingCollector.evaluate(node=>node===document.activeElement),true,'Scene controls retain keyboard focus while ordinary simulation renders');
  results.push('Scene selection controls retain keyboard focus across production updates');
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const beforeTabs=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state);
  await section('Research');
  await page.clock.fastForward(10000);
  await section('World');
  await page.clock.fastForward(10000);
  await section('Build');
  const collectorDetails=page.locator('[data-card-id="collector"] details').first();
  await collectorDetails.locator(':scope > summary').click();
  assert.ok((await collectorDetails.innerText()).includes('hydrogen'),'Expanded details retain the production explanation');
  await collectorDetails.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await collectorDetails.evaluate(node=>node.open),false,'Card details close with the keyboard');
  await page.clock.fastForward(10000);
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const afterTabs=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state);
  assert.ok(afterTabs.elapsed-beforeTabs.elapsed>=30&&afterTabs.elapsed-beforeTabs.elapsed<31,'Tabs preserve elapsed simulation time');
  assert.ok(afterTabs.resources.hydrogen-beforeTabs.resources.hydrogen>=39&&afterTabs.resources.hydrogen-beforeTabs.resources.hydrogen<41,'Collectors produce while research and world tabs are open');
  results.push('Action tabs and reopened card details preserve ordinary elapsed-time production');
  // Isolated UI fixture exercises controls; the independent journey proves normal balance.
  const cosmic=structuredClone(saved.state);
  Object.assign(cosmic.resources,{hydrogen:10000,helium:1000,carbon:0,oxygen:0,elements:0,water:1000,prebiotic:1000});
  await reloadWithState(cosmic);
  await purchase('Build Gas cloud','Build');
  assert.equal(await (await revealControl('Build Sun-like stable star','Build')).isDisabled(),true,'Collapse waits for cloud conditions');
  await page.clock.fastForward(30000);
  await purchase('Build Sun-like stable star','Build');
  await section('World');
  await page.locator('.protostar-timer').waitFor();
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const forming=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state);
  assert.equal(forming.cosmos.protostars.length,1);
  assert.equal(forming.buildings.stableStar??0,0,'Buying a protostar does not grant a mature star');
  const formingRing=playableWorld.locator('[data-process="protostar"]').first();
  await formingRing.waitFor({state:'visible'});
  const ringRemaining=Number(await formingRing.getAttribute('data-remaining'));
  assert.ok(ringRemaining>0,'The scene exposes the real forming-star timer');
  await page.screenshot({path:'artifacts/desktop-protostar.png'});
  await page.clock.fastForward(5000);
  const ringAfter=Number(await formingRing.getAttribute('data-remaining'));
  const progressedStar=await storedState();
  assert.ok(ringAfter<ringRemaining&&Math.abs(ringAfter-progressedStar.cosmos.protostars[0].remaining)<.5,'The scene ring advances with the actual hydrogen-fed simulation');
  assert.ok(progressedStar.elapsed-forming.elapsed>=5&&progressedStar.elapsed-forming.elapsed<6,'Formation feedback uses ordinary elapsed time');
  await page.clock.fastForward(20000);
  assert.equal(await page.locator('.protostar-timer').count(),0,'Fed protostar ignites');
  assert.equal(await playableWorld.locator('[data-process="protostar"]').count(),0,'Ignition removes the completed formation ring');
  await purchase('Unlock Stellar observations','Research');
  await purchase('Build Gas cloud','Build');
  await purchase('Build Massive star','Build');
  await section('World');
  const surveyedTimer=await page.locator('.protostar-timer').innerText();
  assert.match(surveyedTimer,/24s to ignition/,'Stellar research updates the visible fed countdown');
  await page.clock.fastForward(125000);
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const enriched=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state);
  assert.equal(enriched.stats.supernovae,1,'Maturation and supernova happen exactly once');
  for(const name of ['Build accretion disk','Build rocky core','Build solid surface','Build atmosphere','Build oceans']) {
    await purchase(name,'World');
  }
  await revealCard('planet-construction');
  await page.getByRole('heading',{name:'Your planetary system',exact:true}).waitFor();
  await openDetails('Change world profile');
  await (await revealControl(/^Ocean-rich world/)).click();
  assert.equal(await page.getByRole('button',{name:/^Ocean-rich world/}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Stabilize conditions · free',exact:true}).click();
  for(const name of ['Unlock Shallow tidal pools','Unlock Reactive mineral surfaces','Unlock Ocean vent networks']) {
    await purchase(name,'Research');
  }
  await section('World');
  await openDetails('Change world profile');
  await page.getByRole('button',{name:/^Temperate world/}).click();
  assert.equal(await page.getByRole('button',{name:/^Temperate world/}).getAttribute('aria-pressed'),'true','Profile choices remain revisable');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/mobile-world-formation.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Expanded cosmic systems fit a mobile screen');
  await page.setViewportSize({width:1440,height:1050});
  results.push('Cloud prerequisites, fed protostar timers, supernova, all five construction stages, reversible profiles and three prebiotic habitats');
  // A genuine old-schema fixture must be upgraded in place without losing its established world.
  const legacy=structuredClone(enriched);
  legacy.version=1;
  delete legacy.cosmos;
  delete legacy.planet;
  legacy.buildings.planet=1;
  legacy.buildings.pond=2;
  legacy.habitability=75;
  await reloadWithState(legacy);
  await section('World');
  await revealCard('planet-construction');
  await page.getByRole('heading',{name:'Your planetary system',exact:true}).waitFor();
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const migrated=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')));
  assert.equal(migrated.version,2);
  assert.equal(migrated.state.buildings.pond,2);
  assert.equal(migrated.state.upgrades.planetOceans,1);
  assert.equal(migrated.state.planet.profile,'balanced');
  results.push('Legacy v1 slot migrates to v2 with established planetary construction and progress preserved');
  await reloadWithState(saved.state);
  await (await revealControl('Developer tools')).click();
  await page.getByRole('button',{name:'Enter developer universe'}).click();
  await page.getByRole('button',{name:'Living world preset'}).click();
  await page.getByRole('heading',{name:'The beautiful complexity of life'}).waitFor();
  await page.getByRole('button',{name:'Close developer tools'}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'artifacts/desktop-biology.png'});
  await section('Research');
  await chapter('The cosmos');
  await section('World');
  await chapter('Living world');
  assert.equal(await page.getByRole('tab',{name:'Research',exact:true}).getAttribute('aria-selected'),'true','Biology remembers its selected action tab');
  await chapter('The cosmos');
  assert.equal(await page.getByRole('tab',{name:'World',exact:true}).getAttribute('aria-selected'),'true','Cosmos independently remembers its selected action tab');
  await page.getByRole('button',{name:'Show next step',exact:true}).click();
  await page.clock.runFor(100);
  assert.equal(await page.getByRole('tab',{name:'Research',exact:true}).getAttribute('aria-selected'),'true','Guidance selects the appropriate research view');
  await page.getByRole('heading',{name:'The beautiful complexity of life'}).waitFor();
  const guidedPhotosynthesis=page.locator('[data-card-id="photosynthesis"]');
  await guidedPhotosynthesis.locator('xpath=self::*[contains(@class, "guided-target")]').waitFor({state:'visible'});
  assert.equal(await guidedPhotosynthesis.evaluate(card=>card===document.activeElement||card.contains(document.activeElement)),true,'Guidance from an earlier chapter focuses the next biological milestone');
  results.push('Chapters remember their action tabs; Show next step switches chapters and focuses the relevant milestone');
  await checkEvolutionSelection('Desktop');
  assert.equal(await (await revealControl('Unlock Human communities','Research')).isDisabled(),true);
  const humanDetails=page.locator('[data-card-id="humans"] details');
  await humanDetails.locator(':scope > summary').click();
  assert.ok(await humanDetails.locator('li').count()>0,'Locked milestones retain exact missing requirements in touch-accessible Details');
  await humanDetails.locator(':scope > summary').click();
  await page.screenshot({path:'artifacts/desktop-evolution.png'});
  await checkNavigationLocal('Desktop');
  await purchase('Unlock Photosynthetic producers','Research');
  await section('Build');
  await (await revealControl('Build Producer habitat','Build')).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const beforeChapter=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:developer:v1')).state);
  await page.getByRole('navigation',{name:'Game chapters'}).getByRole('button',{name:/The cosmos/}).click();
  await section('World');
  await page.clock.fastForward(10000);
  await page.getByRole('navigation',{name:'Game chapters'}).getByRole('button',{name:/Living world/}).click();
  assert.equal(await page.getByRole('tab',{name:'Build',exact:true}).getAttribute('aria-selected'),'true','Returning to biology restores its last Build view');
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const afterChapter=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:developer:v1')).state);
  assert.equal(afterChapter.phase,1,'Revisiting an earlier chapter preserves the active progression phase');
  assert.equal(afterChapter.upgrades.photosynthesis,1,'Chapter navigation preserves established biology');
  assert.ok(afterChapter.elapsed-beforeChapter.elapsed>=10&&afterChapter.elapsed-beforeChapter.elapsed<11,'Chapter navigation preserves elapsed time');
  assert.ok(afterChapter.resources.biomass>beforeChapter.resources.biomass,'Biology keeps producing while the cosmic world screen is selected');
  console.log('Check passed');
  results.push('Biology preset, ancestry prerequisites, photosynthesis and continued biology across chapters');
  await (await revealControl('Developer tools')).click();
  await page.getByRole('button',{name:'Civilization preset'}).click();
  await page.getByRole('heading',{name:'Our place among the stars'}).waitFor();
  await page.getByRole('button',{name:'Close developer tools'}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await checkGatherConsistency('Desktop');
  const beforeSettlement=await storedState('developer');
  await playableWorld.getByRole('button',{name:'Inspect Housing',exact:true}).click();
  await page.locator('[data-card-id="house"]').waitFor({state:'visible'});
  unchangedPurchases(beforeSettlement,await storedState('developer'),'Inspecting settlement housing is free');
  await purchase('Build Housing','Build');
  const afterSettlement=await storedState('developer');
  assert.equal(afterSettlement.buildings.house,beforeSettlement.buildings.house+1,'The settlement inspector purchases an ordinary housing upgrade');
  await playableWorld.locator(`[data-scene-object="house"][data-owned="${afterSettlement.buildings.house}"]`).waitFor({state:'visible'});
  results.push('Settlement object selection is free and a legal housing purchase updates visible ownership');
  await page.screenshot({path:'artifacts/desktop-civilization.png'});
  await (await revealControl(/Observe ·/,'World')).click();
  const healthBeforeTending=Number(await playableWorld.locator('.playable-scene').getAttribute('data-health'));
  await (await revealControl(/Tend biosphere/,'World')).click();
  const healthAfterTending=Number(await playableWorld.locator('.playable-scene').getAttribute('data-health'));
  const tended=await storedState('developer');
  assert.ok(healthAfterTending>healthBeforeTending,'Settlement scenery responds to ordinary biosphere recovery');
  assert.ok(Math.abs(healthAfterTending-tended.health)<=1,'Scene health derives from actual biosphere health');
  results.push('Settlement scenery tracks biosphere health and responds to the free recovery action');
  await checkBiosphereScenery(tended);
  await checkBiosphereInspector('Desktop');
  assert.equal(await (await revealControl('Unlock Orbital Observatory','Research')).isDisabled(),true);
  console.log('Check passed');
  results.push('Civilization actions and final objective prerequisite lock');
  await page.getByRole('button',{name:/Return to normal game/}).click();
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state.buildings.collector),1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state.phase),0);
  console.log('Check passed');
  results.push('Developer presets never overwrite normal progress');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'artifacts/mobile-cosmos.png'});
  await playableWorld.screenshot({path:'artifacts/mobile-cosmos-scene.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile has no horizontal overflow');
  const mobileCloud=playableWorld.getByRole('button',{name:'Gather hydrogen from cloud',exact:true});
  const mobileCloudBounds=await mobileCloud.boundingBox();
  assert.ok(mobileCloudBounds&&mobileCloudBounds.width>=44&&mobileCloudBounds.height>=44,'The mobile cloud has a large touch target');
  const beforeMobileCloud=await storedState();
  await mobileCloud.click();
  assert.equal((await storedState()).stats.taps,beforeMobileCloud.stats.taps+1,'The mobile world gathers through the ordinary action');
  results.push('390px mobile cloud remains directly playable with a large touch target');
  await page.getByRole('button',{name:'How to play'}).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  await (await revealControl('Developer tools')).click();
  await page.getByRole('button',{name:'Enter developer universe'}).click();
  await page.getByRole('button',{name:'Living world preset'}).click();
  await page.getByRole('button',{name:'Close developer tools'}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'artifacts/mobile-biology.png'});
  await playableWorld.screenshot({path:'artifacts/mobile-biology-scene.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile biology has no horizontal overflow');
  const mobileGoal=await page.locator('.next-milestone').boundingBox();
  const mobileWorld=await page.locator('.world-card').boundingBox();
  assert.ok(mobileGoal&&mobileWorld&&mobileGoal.y<mobileWorld.y,'Mobile next milestone appears before the world illustration');
  await page.getByRole('button',{name:'Show next step',exact:true}).click();
  await page.clock.runFor(100);
  const mobileTarget=page.locator('[data-card-id="photosynthesis"].guided-target');
  await mobileTarget.waitFor({state:'visible'});
  const targetBounds=await mobileTarget.boundingBox();
  const tabsBounds=await page.getByRole('tablist',{name:'Game actions'}).boundingBox();
  const panelBounds=await page.locator('.action-panel').boundingBox();
  assert.ok(targetBounds&&targetBounds.y>=0&&targetBounds.y<844,'Mobile guidance brings its highlighted target into the viewport');
  assert.ok(tabsBounds&&panelBounds&&tabsBounds.y>=0&&tabsBounds.y+tabsBounds.height<=panelBounds.y,'Mobile guidance shows the local tabs immediately before the action panel');
  await revealControl('Unlock Human communities','Research');
  await checkEvolutionSelection('Mobile');
  await checkNavigationLocal('Mobile');
  console.log('Check passed');
  results.push('390px mobile cosmos/biology layout, touch controls, help dialog and Escape');
  // Reuse a completion reached by legal engine actions, not a phase preset.
  await (await revealControl('Developer tools')).click();
  await page.getByRole('button',{name:'Civilization preset'}).click();
  await page.getByRole('button',{name:'Close developer tools'}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await checkGatherConsistency('Mobile');
  await page.screenshot({path:'artifacts/mobile-civilization.png'});
  await playableWorld.screenshot({path:'artifacts/mobile-civilization-scene.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile civilization has no overflow');
  const sceneCaption=await playableWorld.locator('.scene-footer').boundingBox();
  for(const id of ['restoration','power']) {
    const hotspot=await playableWorld.locator(`[data-scene-object="${id}"]`).boundingBox();
    assert.ok(sceneCaption&&hotspot&&hotspot.y+hotspot.height<=sceneCaption.y,`Mobile ${id} remains clear of the scene caption`);
  }
  await checkBiosphereInspector('Mobile');
  if (existsSync('artifacts/legal-completion.json')) {
    const completed=JSON.parse(readFileSync('artifacts/legal-completion.json','utf8'));
    await page.setViewportSize({width:1440,height:1000});
    await reloadWithState(completed);
    await page.getByRole('heading',{name:'From a single atom, a window to the stars.'}).waitFor();
    await page.screenshot({path:'artifacts/desktop-completion.png'});
    await page.getByRole('button',{name:'Keep this world growing'}).click();
    await (await revealControl(/Observe ·/,'World')).click();
    results.push('Legal completed-state return, completion statistics and continued play');
  }
  // Browser lifecycle: hidden production is caught up exactly once, even with hidden autosaves.
  await reloadWithState(saved.state);
  await page.getByRole('button',{name:'Gather hydrogen',exact:true}).waitFor();
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  await page.evaluate(()=>{window.__testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__testHidden});document.dispatchEvent(new Event('visibilitychange'));});
  const beforeHidden=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')));
  await page.clock.fastForward(120000);
  const duringHidden=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')));
  assert.equal(duringHidden.savedAt,beforeHidden.savedAt,'Hidden autosaves preserve the simulation watermark');
  await page.evaluate(()=>{window.__testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const afterHidden=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')));
  assert.ok(afterHidden.state.elapsed-beforeHidden.state.elapsed>=120 && afterHidden.state.elapsed-beforeHidden.state.elapsed<121,'Hidden interval counted once');
  assert.ok(afterHidden.state.resources.hydrogen-beforeHidden.state.resources.hydrogen>=156 && afterHidden.state.resources.hydrogen-beforeHidden.state.resources.hydrogen<158,'Hidden production uses ordinary collector output');
  await page.getByRole('button',{name:'Dismiss return summary'}).click();
  results.push('Two-minute hidden catch-up, autosave watermark and no double counting');
  await reloadWithState(afterHidden.state,600);
  await page.getByText('Welcome back to your universe.',{exact:true}).waitFor();
  assert.ok(await page.getByText(/10m of offline production/).count()>0,'Return summary is displayed');
  await page.getByRole('button',{name:'Dismiss return summary'}).click();
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const offlineOnce=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')));
  await page.reload();
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  const offlineReload=await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')));
  assert.ok(offlineReload.state.elapsed-offlineOnce.state.elapsed<2,'Reload does not repeat offline time');
  results.push('Ten-minute offline return summary and reload idempotence');
  await reloadWithState('invalid-save-preserved');
  await page.getByRole('alert').waitFor();
  await page.clock.fastForward(11000);
  assert.equal(await page.evaluate(()=>localStorage.getItem('stardust-to-civilization:normal:v1')),'invalid-save-preserved');
  await (await revealControl('Reset progress')).click();
  await page.getByRole('button',{name:'Reset this universe',exact:true}).click();
  await page.getByRole('button',{name:'Save progress',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('stardust-to-civilization:normal:v1')).state.stats.taps),0);
  results.push('Invalid-save banner, preserved original and confirmed reset recovery');
  const memoryContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await memoryContext.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable for browser verification');}});});
  const memoryPage=await memoryContext.newPage();
  memoryPage.on('pageerror',error=>errors.push(String(error)));
  await memoryPage.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');
  await memoryPage.getByRole('alert').waitFor();
  for(let n=0;n<15;n++) await memoryPage.getByRole('button',{name:'Gather hydrogen',exact:true}).click();
  await memoryPage.getByRole('button',{name:'Build Gas collector',exact:true}).click();
  await memoryPage.locator('summary').filter({hasText:'Settings'}).click();
  await memoryPage.getByRole('button',{name:'Developer tools',exact:true}).click();
  await memoryPage.getByRole('button',{name:'Enter developer universe'}).click();
  assert.equal(await memoryPage.locator('[data-card-id="collector"]').getByText('×1',{exact:true}).count(),1,'Unsaved normal progress remains in memory');
  assert.equal(await memoryPage.locator('.sandbox-banner').count(),0,'Storage failure prevents losing unsaved progress on slot switching');
  await memoryContext.close();
  results.push('Unavailable storage remains playable and protects unsaved progress during slot switching');
  assert.deepEqual(errors,[],'No browser console or page errors');
  console.log(JSON.stringify({passed:results,presentation,errors,screenshots:'artifacts/'},null,2));
  writeFileSync('artifacts/browser-report.json',JSON.stringify({passed:results,presentation,errors},null,2));
} catch(error) {
  await page.screenshot({path:'artifacts/browser-failure.png',fullPage:true}).catch(()=>{});
  writeFileSync('artifacts/browser-report.json',JSON.stringify({passed:results,presentation,errors,failure:String(error)},null,2));
  throw error;
} finally { await browser.close(); }
