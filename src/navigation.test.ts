import { describe, expect, it } from 'vitest';
import { createGame, DEFINITION_MAP, nextMilestone, preset, type GameState, type Milestone } from './game';
import { recommendNextStep } from './navigation';

function milestone(id: string): Milestone {
  return { id, name: DEFINITION_MAP[id].name, description: '', cost: {}, missing: [], progress: 0 };
}

function livingWorld(): GameState {
  const game = preset(1);
  for (const resource of Object.keys(game.resources) as Array<keyof typeof game.resources>) game.resources[resource] = 100_000;
  return game;
}

describe('next-step navigation', () => {
  it('takes a fresh player to the collector without changing the game', () => {
    const game = createGame(0);
    const before = structuredClone(game);
    expect(recommendNextStep(game)).toMatchObject({ phase: 0, view: 'build', cardId: 'collector' });
    expect(game).toEqual(before);
  });

  it('points to a cloud before a star if its required cloud is missing', () => {
    const game = createGame(0);
    game.buildings.collector = 1;
    expect(recommendNextStep(game, milestone('stableStar'))).toMatchObject({ phase: 0, view: 'build', cardId: 'cloud' });
    game.buildings.cloud = 1;
    expect(recommendNextStep(game, milestone('stableStar'))).toMatchObject({ cardId: 'stableStar', view: 'build' });
  });

  it('takes timed stellar events to the nursery rather than an unrelated purchase', () => {
    const game = createGame(0);
    game.buildings.collector = 1;
    game.cosmos.protostars = [{ id: 1, kind: 'stableStar', remaining: 10, total: 20 }];
    expect(nextMilestone(game).id).toBe('protostar');
    expect(recommendNextStep(game)).toMatchObject({ phase: 0, view: 'world', cardId: 'stellar-nursery' });
    game.cosmos.protostars = [];
    game.buildings.stableStar = 1;
    game.stars = [{ id: 2, remaining: 30 }];
    expect(nextMilestone(game).id).toBe('enrichment');
    expect(recommendNextStep(game)).toMatchObject({ phase: 0, view: 'world', cardId: 'stellar-nursery' });
  });

  it('routes primary planet construction to World', () => {
    const game = livingWorld();
    delete game.upgrades.planetCore;
    expect(recommendNextStep(game, milestone('planetCore'))).toMatchObject({ phase: 0, view: 'world', cardId: 'planet-construction' });
    expect(recommendNextStep(game, milestone('planet'))).toMatchObject({ phase: 0, view: 'world', cardId: 'planet-construction' });
  });

  it('keeps cellular life in cosmic Research and accepts a small stable star', () => {
    const game = livingWorld();
    delete game.upgrades.abiogenesis;
    game.phase = 0;
    delete game.buildings.stableStar;
    game.buildings.redDwarf = 1;
    expect(recommendNextStep(game, milestone('abiogenesis'))).toMatchObject({ phase: 0, view: 'research', cardId: 'abiogenesis' });
  });

  it('guides animal research to the missing producer habitats', () => {
    const game = livingWorld();
    Object.assign(game.upgrades, { photosynthesis: 1, eukaryotes: 1, multicellular: 1 });
    game.buildings.producer = 1;
    const target = recommendNextStep(game, milestone('animals'));
    expect(target).toMatchObject({ phase: 1, view: 'build', cardId: 'producer' });
    expect(target.hint).toContain('Need 2');
    expect(target.hint).toContain('you have 1');
    game.buildings.producer = 2;
    expect(recommendNextStep(game, milestone('animals'))).toMatchObject({ phase: 1, view: 'research', cardId: 'animals' });
  });

  it('follows missing biological research before suggesting a locked producer', () => {
    const game = livingWorld();
    Object.assign(game.upgrades, { eukaryotes: 1, multicellular: 1 });
    expect(recommendNextStep(game, milestone('animals'))).toMatchObject({ phase: 1, view: 'research', cardId: 'photosynthesis' });
  });

  it('routes civilization research to its chapter and initial missing production to Build', () => {
    const game = preset(2);
    game.resources.knowledge = 1000;
    expect(recommendNextStep(game, milestone('writing'))).toMatchObject({ phase: 2, view: 'research', cardId: 'writing' });
    delete game.buildings.workshop;
    game.resources.materials = 0;
    expect(recommendNextStep(game, milestone('writing'))).toMatchObject({ phase: 2, view: 'build', cardId: 'workshop' });
    game.buildings.workshop = 1;
    Object.assign(game.upgrades, { writing: 1, industry: 1 });
    expect(recommendNextStep(game, milestone('electricity'))).toMatchObject({ phase: 2, view: 'build', cardId: 'power' });
    game.buildings.power = 1;
    expect(recommendNextStep(game, milestone('electricity'))).toMatchObject({ phase: 2, view: 'research', cardId: 'electricity' });
  });

  it('describes the immediate material source needed to build a power station', () => {
    const game = preset(2);
    Object.assign(game.upgrades, { writing: 1, industry: 1 });
    delete game.buildings.workshop;
    game.resources.materials = 0;
    const target = recommendNextStep(game, milestone('power'));
    expect(target).toMatchObject({ phase: 2, view: 'build', cardId: 'workshop' });
    expect(target.hint).toContain('Workshop supplies the materials');
  });

  it('supports continued play after completion', () => {
    const game = preset(2);
    game.completed = true;
    expect(recommendNextStep(game)).toEqual({ phase: 2, view: 'build', label: 'Keep building' });
  });
});
