const LAYER_OFFSET = 0.12;
const SIDE_WIDTH = 0.08;
const SIDE_HEIGHT = 0.1;

export function computeBoardLayout(slots, areaWidth, areaHeight) {
  if (!slots.length || areaWidth <= 0 || areaHeight <= 0) {
    return { tileWidth: 0, tileHeight: 0, sideWidth: 0, sideHeight: 0, tiles: [] };
  }
  const positions = slots.map((slot, index) => ({
    index, x: slot.x / 2 - slot.z * LAYER_OFFSET,
    y: slot.y * 2 / 3 - slot.z * LAYER_OFFSET, slot,
  }));
  const minX = Math.min(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const width = Math.max(...positions.map(p => p.x + 1 + SIDE_WIDTH)) - minX;
  const height = Math.max(...positions.map(p => p.y + 4 / 3 + SIDE_HEIGHT)) - minY;
  const tileWidth = Math.min(areaWidth / width, areaHeight / height);
  const offsetX = (areaWidth - width * tileWidth) / 2;
  const offsetY = (areaHeight - height * tileWidth) / 2;
  const order = [...positions].sort((a, b) => a.slot.z - b.slot.z || a.slot.y - b.slot.y || a.slot.x - b.slot.x);
  const ranks = new Map(order.map((p, rank) => [p.index, rank + 1]));
  return {
    tileWidth, tileHeight: tileWidth * 4 / 3,
    sideWidth: tileWidth * SIDE_WIDTH, sideHeight: tileWidth * SIDE_HEIGHT,
    tiles: positions.map(p => ({
      left: offsetX + (p.x - minX) * tileWidth,
      top: offsetY + (p.y - minY) * tileWidth,
      zIndex: ranks.get(p.index),
    })),
  };
}
