import { STAGES } from './stages.js';
import { deal, reshuffle } from './deal.js';
import { isFree, findHint } from './board.js';
import { isMatch } from './tiles.js';

export function createGame(stageId) {
  const stage = STAGES.find(stage => stage.id === stageId);
  if (!stage) throw new RangeError('Unknown stage');
  return { stageId, tiles: deal(stage.slots, stage.seed), history: [], hintsUsed: 0, shufflesUsed: 0 };
}

export function tryRemove(game, idA, idB) {
  if (idA === idB) return false;
  const a = game.tiles.find(tile => tile.id === idA);
  const b = game.tiles.find(tile => tile.id === idB);
  if (!a || !b || !isMatch(a.face, b.face) || !isFree(game.tiles, a) || !isFree(game.tiles, b)) return false;
  game.tiles = game.tiles.filter(tile => tile !== a && tile !== b);
  game.history.push([a, b]);
  return true;
}

export function undo(game) {
  const pair = game.history.pop();
  if (!pair) return false;
  game.tiles.push(...pair);
  game.tiles.sort((a, b) => a.id - b.id);
  return true;
}

export function hint(game) {
  const pair = findHint(game.tiles);
  if (!pair) return null;
  game.hintsUsed++;
  return pair.map(tile => tile.id);
}

export function shuffle(game) {
  const stage = STAGES.find(stage => stage.id === game.stageId);
  if (!stage) return false;
  const seed = (stage.seed ^ Math.imul(game.shufflesUsed + 1, 0x9e3779b9) ^ Math.imul(game.tiles.length, 7919)) >>> 0;
  const tiles = reshuffle(game.tiles, seed);
  if (tiles === null) return false;
  game.tiles = tiles;
  game.shufflesUsed++;
  return true;
}

export function status(game) {
  return game.tiles.length === 0 ? 'cleared' : findHint(game.tiles) ? 'playing' : 'stuck';
}

export function stars(game) {
  if (game.shufflesUsed > 0 || game.hintsUsed > 3) return 1;
  return game.hintsUsed === 0 ? 3 : 2;
}

export function serialize(game) {
  return {
    stageId: game.stageId,
    tiles: game.tiles.map(tile => ({ ...tile })),
    history: game.history.map(pair => pair.map(tile => ({ ...tile }))),
    hintsUsed: game.hintsUsed,
    shufflesUsed: game.shufflesUsed,
  };
}

export function deserialize(obj) {
  return serialize(obj);
}
