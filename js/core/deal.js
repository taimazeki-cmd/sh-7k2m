import { createRng } from './rng.js';
import { groupOf, pickFaces } from './tiles.js';
import { validateLayout } from './board.js';

export let lastSolution = [];

function removalOrder(slots, seed) {
  if (slots.length % 2) return null;
  const bits = slots.map((_, i) => 1n << BigInt(i));
  const blockers = slots.map(tile => {
    let above = 0n;
    let left = 0n;
    let right = 0n;
    slots.forEach((other, i) => {
      if (other.z > tile.z && Math.abs(other.x - tile.x) < 2 && Math.abs(other.y - tile.y) < 2) above |= bits[i];
      if (other.z === tile.z && Math.abs(other.y - tile.y) < 2) {
        if (other.x === tile.x - 2) left |= bits[i];
        if (other.x === tile.x + 2) right |= bits[i];
      }
    });
    return { above, left, right };
  });
  const free = mask => bits.flatMap((bit, i) => {
    const { above, left, right } = blockers[i];
    return (mask & bit) && !(mask & above) && (!(mask & left) || !(mask & right)) ? [i] : [];
  });
  const full = (1n << BigInt(slots.length)) - 1n;
  const dead = new Set();
  for (let attempt = 0; attempt < 64; attempt++) {
    const rng = createRng(seed + Math.imul(attempt, 0x9e3779b9));
    let mask = full;
    const order = [];
    while (mask) {
      const choices = free(mask);
      if (choices.length < 2) {
        dead.add(mask);
        break;
      }
      const a = choices.splice(Math.floor(rng() * choices.length), 1)[0];
      const b = choices[Math.floor(rng() * choices.length)];
      order.push([a, b]);
      mask &= ~(bits[a] | bits[b]);
    }
    if (!mask) return order;
  }
  // A shared budget bounds every branch when randomized retries fail.
  const rng = createRng(seed ^ 0xa511e9b3);
  const order = [];
  let nodes = 0;
  const nodeLimit = 20_000;
  function search(mask) {
    if (nodes >= nodeLimit) return false;
    nodes++;
    if (!mask) return true;
    if (dead.has(mask)) return false;
    const choices = free(mask);
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    for (let i = 0; i < choices.length; i++) {
      for (let j = i + 1; j < choices.length; j++) {
        const a = choices[i];
        const b = choices[j];
        order.push([a, b]);
        if (search(mask & ~(bits[a] | bits[b]))) return true;
        order.pop();
        if (nodes >= nodeLimit) return false;
      }
    }
    dead.add(mask);
    return false;
  }
  return search(full) ? order : null;
}

function assignFaces(tiles, faces, seed) {
  const order = removalOrder(tiles, seed);
  if (order === null) {
    lastSolution = [];
    return null;
  }
  const groups = new Map();
  for (const face of faces) {
    const group = groupOf(face);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(face);
  }
  if ([...groups.values()].some(values => values.length % 2)) {
    lastSolution = [];
    return null;
  }
  const pairs = [...groups.values()].flatMap(values =>
    Array.from({ length: values.length / 2 }, (_, i) => values.slice(i * 2, i * 2 + 2)));
  const rng = createRng(seed ^ 0x63d83595);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const result = tiles.map(tile => ({ ...tile }));
  order.forEach(([a, b], i) => {
    [result[a].face, result[b].face] = pairs[i];
  });
  lastSolution = order.map(([a, b]) => [tiles[a].id, tiles[b].id]);
  return result;
}

export function deal(slots, seed) {
  const errors = validateLayout(slots);
  if (errors.length) throw new RangeError(errors.join('; '));
  const faces = pickFaces(slots.length, createRng(seed));
  const tiles = assignFaces(slots.map((slot, id) => ({ id, ...slot })), faces, seed);
  if (tiles === null) throw new RangeError('Layout has no pair-removal solution');
  return tiles;
}

export function dealWithSolution(slots, seed) {
  const tiles = deal(slots, seed);
  return { tiles, solution: lastSolution.map(pair => [...pair]) };
}

export function reshuffle(tiles, seed) {
  return assignFaces(tiles, tiles.map(tile => tile.face), seed);
}
