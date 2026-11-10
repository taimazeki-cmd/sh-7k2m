import { STAGES } from './core/stages.js';
import { freeTiles } from './core/board.js';
import { createGame, tryRemove, undo, hint, shuffle, status, stars, serialize, deserialize } from './core/game.js';
import { computeBoardLayout } from './ui/layout.js';
import { createStorage } from './ui/storage.js';
import { createTimer, formatTime, isStageUnlocked, recordClear } from './ui/session.js';
import { tileArtwork, faceLabel, starArtwork, lockArtwork } from './ui/tiles.js';

const $ = id => document.getElementById(id);
const store = createStorage();
let { progress, current, settings } = store.load();
let game = current?.game ?? null;
let timer = createTimer(current?.elapsedMs ?? 0);
let screen = 'stages';
let selected = null;
let hinted = [];
let hintTimeout;
let noticeTimeout;
let busy = false;
let clearResult = null;
const sheet = $('sheet');
const now = () => performance.now();
const elapsed = () => timer.value(now());
function save() {
  if (game) store.writeCurrent(game, elapsed());
}
function syncTimer() {
  timer.setRunning(screen === 'game' && !document.hidden && !sheet.open && Boolean(game?.tiles.length), now());
  $('timer').textContent = formatTime(elapsed());
}
function notice(message) {
  clearTimeout(noticeTimeout);
  $('notice').textContent = message;
  noticeTimeout = setTimeout(() => { $('notice').textContent = ''; }, 2400);
}
function clearInteraction() {
  selected = null;
  hinted = [];
  clearTimeout(hintTimeout);
}
function showSheet(title, body, actions) {
  $('sheet-title').textContent = title;
  $('sheet-body').replaceChildren();
  if (typeof body === 'string') $('sheet-body').innerHTML = body;
  else $('sheet-body').append(body);
  $('sheet-actions').replaceChildren();
  for (const [index, action] of actions.entries()) {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.disabled = Boolean(action.disabled);
    if (index === 0) button.className = 'primary';
    button.addEventListener('click', () => { sheet.close(); syncTimer(); action.run(); });
    $('sheet-actions').append(button);
  }
  sheet.showModal();
  syncTimer();
  save();
}
sheet.addEventListener('close', syncTimer);
function renderStages() {
  const cleared = Object.keys(progress).length;
  $('clear-count').textContent = `${cleared} / 50 クリア`;
  $('star-count').textContent = `星 ${Object.values(progress).reduce((sum, entry) => sum + entry.stars, 0)} / 150`;
  $('resume').hidden = !game?.tiles.length;
  $('resume').textContent = game ? `つづきから（ステージ ${game.stageId}）` : '';
  const nextStage = STAGES.find(stage => !progress[stage.id] && isStageUnlocked(stage.id, progress, location.search))?.id;
  const cards = STAGES.map(stage => {
    const entry = progress[stage.id];
    const open = isStageUnlocked(stage.id, progress, location.search);
    const button = document.createElement('button');
    button.className = `stage-card${stage.id === nextStage ? ' next' : ''}`;
    button.disabled = !open;
    button.dataset.stage = stage.id;
    button.setAttribute('aria-label', `ステージ ${stage.id} ${stage.name}、${open ? `星 ${entry?.stars ?? 0}` : '未開放'}`);
    button.innerHTML = `<span class="stage-number">${stage.id}</span>${open ? `<span class="stars">${starArtwork(entry?.stars ?? 0)}</span>` : lockArtwork}`;
    button.addEventListener('click', () => startStage(stage.id));
    return button;
  });
  $('stage-grid').replaceChildren(...cards);
}
function switchScreen(next) {
  screen = next;
  $('stages-screen').hidden = next !== 'stages';
  $('game-screen').hidden = next !== 'game';
  $('notice').textContent = '';
  syncTimer();
}
function showStages() {
  if (busy) return;
  clearInteraction();
  switchScreen('stages');
  save();
  renderStages();
  $('title').tabIndex = -1;
  $('title').focus();
}
function startStage(stageId) {
  if (!isStageUnlocked(stageId, progress, location.search)) return;
  game = createGame(stageId);
  timer = createTimer();
  clearResult = null;
  enterGame();
}
function enterGame() {
  clearInteraction();
  switchScreen('game');
  renderGame();
  save();
  checkStatus();
}
function renderGame() {
  if (screen !== 'game' || !game) return;
  const stage = STAGES[game.stageId - 1];
  $('stage-title').textContent = `${stage.id} ${stage.name}`;
  $('remaining').textContent = `残り ${game.tiles.length}`;
  $('hint-count').textContent = `${game.hintsUsed} 回`;
  $('undo').disabled = busy || !game.history.length;
  for (const id of ['hint', 'shuffle', 'restart']) $(id).disabled = busy || !game.tiles.length;
  drawBoard();
}
function drawBoard() {
  if (screen !== 'game' || !game || busy) return;
  const stage = STAGES[game.stageId - 1];
  const board = $('board');
  const layout = computeBoardLayout(stage.slots, board.clientWidth, board.clientHeight);
  board.style.setProperty('--tile-width', `${layout.tileWidth}px`);
  board.style.setProperty('--tile-height', `${layout.tileHeight}px`);
  board.style.setProperty('--side-width', `${layout.sideWidth}px`);
  board.style.setProperty('--side-height', `${layout.sideHeight}px`);
  const freeIds = new Set(freeTiles(game.tiles).map(tile => tile.id));
  board.replaceChildren(...game.tiles.map(tile => {
    const position = layout.tiles[tile.id];
    const button = document.createElement('button');
    const free = freeIds.has(tile.id);
    button.className = `tile${settings.dimBlocked && !free ? ' blocked' : ''}${selected === tile.id ? ' selected' : ''}${hinted.includes(tile.id) ? ' hinted' : ''}`;
    button.dataset.id = tile.id;
    button.style.left = `${position.left}px`;
    button.style.top = `${position.top}px`;
    button.style.zIndex = position.zIndex;
    button.setAttribute('aria-label', `${faceLabel(tile.face)}、${free ? '選択可能' : '今は取れません'}`);
    button.setAttribute('aria-pressed', String(selected === tile.id));
    button.innerHTML = `<span class="tile-face">${tileArtwork(tile.face)}</span>`;
    button.addEventListener('click', () => tapTile(tile.id, free, button));
    return button;
  }));
}
function tapTile(id, free, button) {
  if (busy) return;
  hinted = [];
  clearTimeout(hintTimeout);
  if (!free) {
    document.querySelectorAll('.hinted').forEach(tile => tile.classList.remove('hinted'));
    button.classList.remove('shaking');
    void button.offsetWidth;
    button.classList.add('shaking');
    button.addEventListener('animationend', () => button.classList.remove('shaking'), { once: true });
    notice('上に牌がなく、左右どちらかが空いた牌を選べます。');
    return;
  }
  if (selected === id) { selected = null; drawBoard(); return; }
  const first = selected;
  if (first !== null && tryRemove(game, first, id)) {
    selected = null;
    if (!game.tiles.length) finishClear();
    save();
    busy = true;
    for (const tileId of [first, id]) $('board').querySelector(`[data-id="${tileId}"]`)?.classList.add('removing');
    renderGame();
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fade-duration'));
    setTimeout(() => {
      busy = false;
      renderGame();
      checkStatus();
    }, delay);
  } else { selected = id; drawBoard(); }
}
function finishClear() {
  syncTimer();
  const ms = elapsed();
  const earned = stars(game);
  const previous = progress[game.stageId];
  clearResult = { ms, earned, best: !previous || ms < previous.bestMs };
  progress = recordClear(progress, game.stageId, earned, ms);
  store.writeProgress(progress);
  store.clearCurrent();
  return clearResult;
}
function checkStatus() {
  const state = status(game);
  if (state === 'cleared') {
    const { ms, earned, best } = clearResult ?? finishClear();
    const actions = [];
    if (game.stageId < STAGES.length) actions.push({ label: '次のステージ', run: () => startStage(game.stageId + 1) });
    actions.push({ label: 'ステージ選択', run: showStages });
    showSheet('クリア！', `<span class="stars" aria-label="星 ${earned}">${starArtwork(earned)}</span><p>タイム ${formatTime(ms)}</p>${best ? '<p class="gold">自己ベスト更新！</p>' : ''}${game.stageId === 50 ? '<p class="gold">全50ステージ踏破、おめでとうございます！</p>' : ''}`, actions);
  } else if (state === 'stuck') {
    const canShuffle = shuffle(deserialize(serialize(game)));
    showSheet('取れる牌がありません', '<p>並べ直すか、ひと組戻してみましょう。</p>', [
      { label: 'シャッフル', disabled: !canShuffle, run: shuffleGame },
      { label: '1 手戻す', disabled: !game.history.length, run: undoGame },
      { label: 'やり直し', run: confirmRestart },
    ]);
  }
}
function undoGame() {
  clearInteraction();
  if (undo(game)) { clearResult = null; syncTimer(); save(); renderGame(); }
}
function shuffleGame() {
  clearInteraction();
  if (shuffle(game)) { save(); renderGame(); checkStatus(); }
  else { drawBoard(); notice('この配置では並べ直せません。戻すか、やり直してください。'); }
}
function confirmRestart() {
  if (busy) return;
  clearInteraction();
  drawBoard();
  showSheet('最初からやり直しますか？', '<p>このステージの中断データをリセットします。</p>', [
    { label: 'やり直す', run: () => startStage(game.stageId) },
    { label: 'つづける', run: () => {} },
  ]);
}
$('back').addEventListener('click', showStages);
$('resume').addEventListener('click', enterGame);
$('undo').addEventListener('click', undoGame);
$('shuffle').addEventListener('click', shuffleGame);
$('restart').addEventListener('click', confirmRestart);
$('hint').addEventListener('click', () => {
  if (busy) return;
  clearInteraction();
  hinted = hint(game) ?? [];
  save();
  renderGame();
  hintTimeout = setTimeout(() => { hinted = []; drawBoard(); }, 2000);
  if (!hinted.length) checkStatus();
});
$('settings').addEventListener('click', () => {
  if (busy) return;
  clearInteraction();
  drawBoard();
  const label = document.createElement('label');
  label.className = 'setting-label';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = settings.dimBlocked;
  checkbox.addEventListener('change', () => {
    settings.dimBlocked = checkbox.checked;
    store.writeSettings(settings);
    drawBoard();
  });
  label.append(checkbox, '取れない牌を暗くする');
  showSheet('設定', label, [{ label: '閉じる', run: () => {} }]);
});
document.addEventListener('visibilitychange', () => { syncTimer(); save(); });
window.addEventListener('pagehide', () => { timer.setRunning(false, now()); save(); });
window.addEventListener('pageshow', syncTimer);
window.addEventListener('resize', drawBoard);
new ResizeObserver(drawBoard).observe($('board'));
setInterval(() => { if (screen === 'game' && !document.hidden) $('timer').textContent = formatTime(elapsed()); }, 250);
renderStages();
