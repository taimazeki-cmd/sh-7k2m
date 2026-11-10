export function createTimer(elapsedMs = 0) {
  let elapsed = elapsedMs;
  let started = null;
  return {
    setRunning(running, now) {
      if (started !== null) elapsed += Math.max(0, now - started);
      started = running ? now : null;
    },
    value(now) { return elapsed + (started === null ? 0 : Math.max(0, now - started)); },
  };
}
export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export function isStageUnlocked(stageId, progress, search = '') {
  return new URLSearchParams(search).get('unlock') === 'all' || stageId === 1 || Boolean(progress[stageId - 1]);
}
export function recordClear(progress, stageId, stars, elapsedMs) {
  const previous = progress[stageId];
  return { ...progress, [stageId]: { stars: Math.max(previous?.stars ?? 0, stars), bestMs: Math.min(previous?.bestMs ?? Infinity, elapsedMs) } };
}
