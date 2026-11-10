import { isMatch, groupOf } from './tiles.js';

export function isFree(tiles, tile) {
  let left = false;
  let right = false;
  for (const other of tiles) {
    if (other === tile) continue;
    if (other.z > tile.z && Math.abs(other.x - tile.x) < 2 && Math.abs(other.y - tile.y) < 2) {
      return false;
    }
    if (other.z === tile.z && Math.abs(other.y - tile.y) < 2) {
      if (other.x === tile.x - 2) left = true;
      if (other.x === tile.x + 2) right = true;
    }
  }
  return !left || !right;
}

export function freeTiles(tiles) {
  return tiles.filter(tile => isFree(tiles, tile));
}

export function availablePairs(tiles) {
  const free = freeTiles(tiles);
  const pairs = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (isMatch(free[i].face, free[j].face)) pairs.push([free[i], free[j]]);
    }
  }
  return pairs;
}

export function findHint(tiles) {
  const pairs = availablePairs(tiles);
  if (!pairs.length) return null;
  const blockedGroups = new Set(tiles.filter(tile => !isFree(tiles, tile)).map(tile => groupOf(tile.face)));
  const fallback = pairs.find(([tile]) => !blockedGroups.has(groupOf(tile.face))) ?? pairs[0];
  const count = tiles.length;
  const active = new Uint8Array(count).fill(1);
  const groups = tiles.map(tile => groupOf(tile.face));
  const remaining = new Uint16Array(42);
  const blockers = Array.from({ length: 3 }, () => new Uint16Array(count));
  const dependents = Array.from({ length: count }, () => []);
  const groupMembers = Array.from({ length: 42 }, () => []);
  groups.forEach((group, index) => groupMembers[group].push(index));
  const aboveOf = Array.from({ length: count }, () => []);
  const bits = tiles.map((_, index) => 1n << BigInt(index));
  for (let i = 0; i < count; i++) {
    remaining[groups[i]]++;
    const tile = tiles[i];
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const other = tiles[j];
      let kind = -1;
      if (other.z > tile.z && Math.abs(other.x - tile.x) < 2 && Math.abs(other.y - tile.y) < 2) kind = 0;
      else if (other.z === tile.z && Math.abs(other.y - tile.y) < 2) {
        if (other.x === tile.x - 2) kind = 1;
        if (other.x === tile.x + 2) kind = 2;
      }
      if (kind === 0) aboveOf[i].push(j);
      if (kind !== -1) { blockers[kind][i]++; dependents[j].push([i, kind]); }
    }
  }
  const free = index => active[index] && blockers[0][index] === 0 && (blockers[1][index] === 0 || blockers[2][index] === 0);
  const change = (index, delta) => {
    active[index] = delta > 0 ? 1 : 0;
    remaining[groups[index]] += delta;
    for (const [dependent, kind] of dependents[index]) blockers[kind][dependent] += delta;
  };
  const failed = new Set();
  const solution = [];
  let nodes = 0;
  function search(state) {
    if (nodes >= 20000) return false;
    nodes++;
    if (state === 0n) return true;
    if (failed.has(state)) return false;
    // 残り2枚の組どうしが上牌で循環すると、どの組も先に取り除けない。
    const visiting = new Uint8Array(42);
    function hasCoverCycle(group) {
      if (visiting[group] === 1) return true;
      if (visiting[group] === 2) return false;
      visiting[group] = 1;
      for (const index of groupMembers[group]) {
        if (!active[index]) continue;
        for (const above of aboveOf[index]) {
          const parent = groups[above];
          if (active[above] && remaining[parent] === 2 && hasCoverCycle(parent)) return true;
        }
      }
      visiting[group] = 2;
      return false;
    }
    for (let group = 0; group < 42; group++) {
      if (remaining[group] === 2 && hasCoverCycle(group)) { failed.add(state); return false; }
    }
    const freeByGroup = Array.from({ length: 42 }, () => []);
    for (let index = 0; index < count; index++) if (free(index)) freeByGroup[groups[index]].push(index);
    let candidates = [];
    for (const list of freeByGroup) {
      if (list.length < 2) continue;
      // 全て自由な組は、先に取り除いても他の牌を塞がない。
      if (list.length === remaining[groups[list[0]]]) {
        candidates = [{ a: list[0], b: list[1], score: Infinity }];
        break;
      }
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const affected = new Set([...dependents[a], ...dependents[b]].map(([index]) => index));
        const blocked = [...affected].filter(index => active[index] && !free(index));
        change(a, -1); change(b, -1);
        const score = blocked.filter(free).length;
        change(b, 1); change(a, 1);
        candidates.push({ a, b, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    for (const { a, b } of candidates) {
      change(a, -1); change(b, -1);
      solution.push([a, b]);
      if (search(state ^ bits[a] ^ bits[b])) return true;
      solution.pop();
      change(b, 1); change(a, 1);
      if (nodes >= 20000) return false;
    }
    failed.add(state);
    return false;
  }
  if (search((1n << BigInt(count)) - 1n)) return solution[0].map(index => tiles[index]);
  return fallback;
}

export function validateLayout(slots) {
  const errors = [];
  if (slots.length % 2) errors.push('odd-count: tile count must be even');
  const valid = slots.map((slot, i) => {
    const inside = slot != null && ['x', 'y', 'z'].every(key => Number.isInteger(slot[key]))
      && slot.x >= 0 && slot.x <= 14 && slot.y >= 0 && slot.y <= 18 && slot.z >= 0 && slot.z <= 4;
    if (!inside) errors.push(`out-of-range: slot ${i}`);
    return inside;
  });
  for (let i = 0; i < slots.length; i++) {
    if (!valid[i]) continue;
    const tile = slots[i];
    for (let j = i + 1; j < slots.length; j++) {
      const other = slots[j];
      if (valid[j] && tile.z === other.z && Math.abs(tile.x - other.x) < 2 && Math.abs(tile.y - other.y) < 2) {
        errors.push(`overlap: slots ${i}, ${j}`);
      }
    }
    if (tile.z === 0) continue;
    const supported = [0, 1].every(dx => [0, 1].every(dy => slots.some((other, j) =>
      valid[j] && other.z === tile.z - 1
      && other.x <= tile.x + dx && tile.x + dx < other.x + 2
      && other.y <= tile.y + dy && tile.y + dy < other.y + 2)));
    if (!supported) errors.push(`floating: slot ${i}`);
  }
  return errors;
}
