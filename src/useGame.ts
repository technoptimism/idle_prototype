import { useCallback, useEffect, useRef, useState } from 'react';
import { act, createGame, preset, tick } from './game';
import type { GameState, Phase } from './game';
import { deleteGame, loadGame, saveGame } from './persistence';
import type { SaveSlot } from './persistence';

type GameAction = Parameters<typeof act>[1];
const MAX_OFFLINE = 8 * 60 * 60;

export function useGame() {
  const [initial] = useState(() => loadGame('normal'));
  const simulation = useRef<GameState>(initial.state ?? createGame());
  const [game, setGame] = useState(simulation.current);
  const [slot, setSlot] = useState<SaveSlot>('normal');
  const slotRef = useRef<SaveSlot>('normal');
  const [message, setMessage] = useState(initial.message ?? 'Your universe saves automatically.');
  const [returnSummary, setReturnSummary] = useState(initial.offline?.summary ?? '');
  const [storageBlocked, setStorageBlocked] = useState(initial.blocked);
  const blocked = useRef(initial.blocked);
  const [speed, setSpeedState] = useState(1);
  const speedRef = useRef(1);
  const clock = useRef(Date.now());
  const hidden = useRef(document.hidden);
  const dirty = useRef(false);

  const publish = useCallback((next: GameState) => {
    simulation.current = next;
    dirty.current = true;
    setGame(next);
  }, []);
  const advance = useCallback((now = Date.now()) => {
    const seconds = Math.max(0, (now - clock.current) / 1000);
    clock.current = now;
    if (seconds > 0) simulation.current = tick(simulation.current, seconds * speedRef.current);
    dirty.current = true;
  }, []);
  const save = useCallback((manual = true) => {
    if (blocked.current) {
      if (manual) setMessage('The unreadable save is protected. Use Reset progress to start a new save in this slot.');
      return false;
    }
    if (!hidden.current) advance();
    const result = saveGame(simulation.current, slotRef.current, clock.current);
    if (manual || !result.ok) setMessage(result.message ?? (result.ok ? 'Progress saved on this device.' : 'Storage unavailable; keep this tab open to continue.'));
    return result.ok;
  }, [advance]);

  useEffect(() => {
    const simulationTimer = window.setInterval(() => { if (!hidden.current) advance(); }, 100);
    const renderTimer = window.setInterval(() => {
      if (dirty.current) { setGame(simulation.current); dirty.current = false; }
    }, 250);
    const saveTimer = window.setInterval(() => save(false), 10000);
    const visibility = () => {
      const now = Date.now();
      if (document.hidden) {
        if (!hidden.current) advance(now);
        hidden.current = true;
        save(false);
      } else if (hidden.current) {
        const seconds = Math.min(MAX_OFFLINE, Math.max(0, (now - clock.current) / 1000));
        simulation.current = tick(simulation.current, seconds);
        if (seconds >= 10) setReturnSummary(`While you were away, your universe continued for ${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s. Production and stellar events were simulated; no purchases were made except enabled stellar automation.`);
        hidden.current = false;
        clock.current = now;
        publish(simulation.current);
        save(false);
      }
    };
    const unload = () => save(false);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', unload);
    return () => {
      clearInterval(simulationTimer); clearInterval(renderTimer); clearInterval(saveTimer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', unload);
    };
  }, [advance, publish, save]);

  const dispatch = useCallback((action: GameAction) => {
    if (!hidden.current) advance();
    const current = simulation.current;
    const next = act(current, action);
    publish(next);
    return next !== current;
  }, [advance, publish]);

  const switchSlot = useCallback((next: SaveSlot) => {
    if (next === slotRef.current) return;
    const saved = save(false);
    if (!saved) {
      setMessage('This universe could not be saved. Keep playing here to preserve progress in memory. Reload when storage is available, or explicitly reset this slot.');
      return;
    }
    const loaded = loadGame(next);
    slotRef.current = next;
    blocked.current = loaded.blocked;
    setStorageBlocked(loaded.blocked);
    setSlot(next);
    speedRef.current = 1; setSpeedState(1);
    clock.current = Date.now();
    publish(loaded.state ?? createGame());
    setMessage(loaded.message ?? (next === 'developer' ? 'Developer sandbox · normal progress is stored separately.' : 'Normal universe restored.'));
    setReturnSummary(loaded.offline?.summary ?? '');
  }, [publish, save]);

  const setSpeed = useCallback((next: number) => {
    if (slotRef.current !== 'developer') return;
    advance(); speedRef.current = next; setSpeedState(next);
  }, [advance]);
  const startPreset = useCallback((phase: Phase) => {
    if (slotRef.current !== 'developer') return;
    clock.current = Date.now();
    publish(preset(phase));
    setMessage('Sandbox preset loaded. Your normal universe is safe in its own save slot.');
  }, [publish]);
  const reset = useCallback(() => {
    const result = deleteGame(slotRef.current);
    if (!result.ok && blocked.current) { setMessage(result.message ?? 'Unable to reset this save.'); return; }
    blocked.current = false; setStorageBlocked(false);
    clock.current = Date.now();
    speedRef.current = 1; setSpeedState(1);
    publish(createGame());
    setMessage(result.ok ? 'A new universe. Every story begins with hydrogen.' : result.message ?? 'Started a new universe in memory. Storage is unavailable.');
    setReturnSummary('');
  }, [publish]);
  return {game, slot, speed, message, returnSummary, storageBlocked, dispatch, save, switchSlot, setSpeed, startPreset, reset, dismissReturn: () => setReturnSummary('')};
}
