const root = document.getElementById('gpt-reversi-in-chat');
const $ = name => root.querySelector('[data-rv="' + name + '"]');
const bootstrap = JSON.parse(root.querySelector('#gpt-reversi-bootstrap').textContent);
const command = JSON.parse(root.querySelector('#gpt-reversi-command').textContent);
let state = bootstrap ? validateSession(bootstrap) : newSession(crypto.randomUUID());
let error = '', busy = false, sentRevision = -1, sent = false, restored = false;
const logs = [];
const log = entry => { logs.push(entry); $('diagnostic').textContent = JSON.stringify(logs.slice(-12), null, 2); };
function restore(candidate, initial = false) {
  if (!candidate) return false;
  try {
    validateSession(candidate);
    if (initial && !bootstrap || candidate.gameId === state.gameId && candidate.revision > state.revision) {
      state = candidate; sent = false; sentRevision = -1; restored = true;
      return true;
    }
  } catch { log({ rejectedSavedState: true }); }
  return false;
}
restore(window.openai?.widgetState?.privateContent?.reversi, true);
function persist() {
  const save = window.openai?.setWidgetState;
  if (typeof save !== 'function') return;
  try {
    const answer = save({ modelContent: view(state), privateContent: { reversi: state } });
    if (answer?.catch) answer.catch(() => log({ statePersistence: 'failed' }));
  } catch { log({ statePersistence: 'failed' }); }
}
function render() {
  const current = view(state);
  $('black').textContent = current.black;
  $('white').textContent = current.white;
  $('status').textContent = busy ? 'GPTへ盤面を渡しています' : state.turn === 'B' ? 'あなた（黒）の手番です' : state.turn === 'finished' ? '対局終了 · ' + (current.black === current.white ? '引き分け' : current.black > current.white ? 'あなたの勝ち' : 'GPTの勝ち') : sent ? 'GPTの応答と盤面への反映を待っています' : restored ? '白の手番を復元しました。応答が止まっている場合は再依頼できます' : '白の手番です。GPTへの接続を確認してください';
  $('error').textContent = error;
  $('retry').hidden = state.turn !== 'W' || busy;
  $('retry').textContent = sent ? '応答が止まった場合に再依頼' : 'GPTに白の手番を再依頼';
  $('detail').textContent = '画面内実行版 0.1.1 · 盤面版 ' + state.revision;
  root.dataset.revision = String(state.revision);
  root.dataset.turn = state.turn;
  root.dataset.rows = state.rows.join('/');
  root.dataset.gameId = state.gameId;
  $('board').replaceChildren(...[...state.rows.join('')].map((v, i) => {
    const cell = cellName(i), can = state.turn === 'B' && !busy && current.legalMoves.includes(cell);
    const button = document.createElement('button'); button.className = 'rv-cell'; button.type = 'button'; button.disabled = !can;
    button.setAttribute('aria-label', cell + (v === 'B' ? ' 黒' : v === 'W' ? ' 白' : can ? ' 打てます' : ' 空き'));
    if (v !== '.') { const disc = document.createElement('span'); disc.className = 'rv-disc rv-' + v; disc.style.display = 'block'; button.append(disc); }
    else if (can) { const hint = document.createElement('span'); hint.className = 'rv-hint'; button.append(hint); }
    button.onclick = () => playBlack(cell);
    return button;
  }));
}
async function askGpt() {
  if (state.turn !== 'W' || busy || sentRevision === state.revision) return;
  const requestedGame = state.gameId, requestedRevision = state.revision;
  busy = true; error = ''; render();
  try {
    if (typeof window.openai?.sendFollowUpMessage !== 'function') throw Error('この表示方法には、現在のチャットのGPTへ手番を送る機能がありません。黒の着手は画面内で反映しましたが、自動応答は成立していません。');
    const prompt = turnPrompt(state);
    log({ action: 'request-gpt', gameId: state.gameId, revision: state.revision, method: 'window.openai.sendFollowUpMessage' });
    await window.openai.sendFollowUpMessage({ prompt, title: 'GPTに白の一手を依頼' });
    if (state.gameId === requestedGame && state.revision === requestedRevision) { sentRevision = requestedRevision; sent = true; }
    log({ action: 'host-request-resolved', revision: requestedRevision, gptMoveApplied: false });
  } catch (cause) { error = cause.message || String(cause); log({ action: 'request-failed', message: error }); }
  finally { busy = false; render(); }
}
function playBlack(cell) {
  try { state = move(state, cell, 'B'); restored = false; sent = false; error = ''; persist(); render(); if (state.turn === 'W') void askGpt(); }
  catch (cause) { error = cause.message; render(); }
}
$('retry').onclick = () => { sentRevision = -1; void askGpt(); };
window.addEventListener('openai:set_globals', event => {
  restore(event.detail?.globals?.widgetState?.privateContent?.reversi);
  render();
});
if (command) {
  try { state = applyWhiteCommand(state, command); persist(); log({ action: 'white-applied', revision: state.revision, cell: command.cell }); }
  catch (cause) { error = cause.message; log({ action: 'white-rejected', message: error }); }
}
log({ runtime: 'in-chat', externalGameServer: false, inferenceApi: false, hostFollowUp: typeof window.openai?.sendFollowUpMessage === 'function', hostState: typeof window.openai?.setWidgetState === 'function' });
render();
if (command && !error && state.turn === 'W') void askGpt();
