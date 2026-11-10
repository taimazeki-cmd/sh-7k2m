export const FACE_COUNT = 42;

export function groupOf(face) {
  return face >= 38 ? 38 : face >= 34 ? 34 : face;
}

export function isMatch(faceA, faceB) {
  return groupOf(faceA) === groupOf(faceB);
}

function shuffled(values, rng) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function pickFaces(count, rng) {
  if (!Number.isInteger(count) || count < 0 || count > 144 || count % 2) {
    throw new RangeError('Tile count must be even and between 0 and 144');
  }
  const groups = shuffled([...Array.from({ length: 34 }, (_, i) => i), 34, 38], rng);
  const faces = [];
  for (let i = 0; faces.length < count; i++) {
    const group = groups[i];
    const size = Math.min(4, count - faces.length);
    const choices = group >= 34
      ? shuffled(Array.from({ length: 4 }, (_, j) => group + j), rng).slice(0, size)
      : Array(size).fill(group);
    faces.push(...choices);
  }
  return shuffled(faces, rng);
}
