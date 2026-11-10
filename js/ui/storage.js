import { deserialize, serialize } from '../core/game.js';
import { STAGES } from '../core/stages.js';
import { isMatch } from '../core/tiles.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isTime = value => Number.isFinite(value) && value >= 0;
const isCount = value => Number.isSafeInteger(value) && value >= 0;
function parse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}
export function readProgress(raw) {
  const data = parse(raw);
  const progress = {};
  if (!isRecord(data)) return progress;
  for (const stage of STAGES) {
    const entry = data[stage.id];
    if (isRecord(entry) && Number.isInteger(entry.stars) && entry.stars >= 1 && entry.stars <= 3 && isTime(entry.bestMs)) {
      progress[stage.id] = { stars: entry.stars, bestMs: entry.bestMs };
    }
  }
  return progress;
}
export function readSettings(raw) {
  const data = parse(raw);
  return { dimBlocked: typeof data?.dimBlocked === 'boolean' ? data.dimBlocked : true };
}
export function readCurrent(raw) {
  try {
    const data = parse(raw);
    if (!isRecord(data) || !isTime(data.elapsedMs) || !isRecord(data.game)) return null;
    const game = deserialize(data.game);
    const stage = STAGES.find(s => s.id === game.stageId);
    if (!stage || !isCount(game.hintsUsed) || !isCount(game.shufflesUsed) || !Array.isArray(game.tiles) || !game.tiles.length || !Array.isArray(game.history)) return null;
    if (!game.history.every(pair => Array.isArray(pair) && pair.length === 2 && isMatch(pair[0]?.face, pair[1]?.face))) return null;
    const allTiles = [...game.tiles, ...game.history.flat()];
    if (allTiles.length !== stage.slots.length || new Set(allTiles.map(tile => tile?.id)).size !== allTiles.length) return null;
    if (!allTiles.every(tile => {
      const slot = stage.slots[tile?.id];
      return slot && Number.isInteger(tile.id) && Number.isInteger(tile.face) && tile.face >= 0 && tile.face < 42 && ['x', 'y', 'z'].every(key => tile[key] === slot[key]);
    })) return null;
    return { game, elapsedMs: data.elapsedMs };
  } catch { return null; }
}
function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}
export function createStorage(storage = browserStorage()) {
  const read = key => { try { return storage?.getItem(`shanghai.${key}`) ?? null; } catch { return null; } };
  const write = (key, value) => {
    try {
      if (value === null) storage?.removeItem(`shanghai.${key}`);
      else storage?.setItem(`shanghai.${key}`, JSON.stringify(value));
      return Boolean(storage);
    } catch { return false; }
  };
  return {
    load: () => ({ progress: readProgress(read('progress')), current: readCurrent(read('current')), settings: readSettings(read('settings')) }),
    writeProgress: progress => write('progress', progress),
    writeSettings: settings => write('settings', settings),
    writeCurrent: (game, elapsedMs) => write('current', game?.tiles.length ? { game: serialize(game), elapsedMs } : null),
    clearCurrent: () => write('current', null),
  };
}
