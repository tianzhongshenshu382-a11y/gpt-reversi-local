import { initialBoard, legalMoves, applyMove } from './engine.mjs';

export function newSession(gameId) {
  return { format: 'reversi-in-chat-1', gameId, revision: 0, rows: rows(initialBoard()), turn: 'B', history: [], receipts: [] };
}
export function rows(board) { return Array.from({ length: 8 }, (_, i) => board.slice(i * 8, i * 8 + 8).join('')); }
function nextTurn(board, side) {
  const other = side === 'B' ? 'W' : 'B';
  return legalMoves(board, other).length ? other : legalMoves(board, side).length ? side : 'finished';
}
export function validateSession(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || state.format !== 'reversi-in-chat-1' || typeof state.gameId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(state.gameId) || !Number.isInteger(state.revision) || state.revision < 0 || state.revision > 60 || !['B', 'W', 'finished'].includes(state.turn) || !Array.isArray(state.rows) || state.rows.length !== 8 || state.rows.some(r => typeof r !== 'string' || !/^[.BW]{8}$/.test(r)) || !Array.isArray(state.history) || state.history.length !== state.revision || !Array.isArray(state.receipts) || state.receipts.length > 60) throw Error('盤面データが不正です。');
  // Snapshots cross the chat boundary. Reconstruct them from legal moves instead
  // of trusting independently supplied rows, history, and turn fields.
  let board = initialBoard(), turn = 'B';
  for (const entry of state.history) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !['B', 'W'].includes(entry.side) || entry.side !== turn || typeof entry.cell !== 'string' || !/^[A-H][1-8]$/.test(entry.cell) || entry.source !== (entry.side === 'W' ? 'chat-gpt' : 'human') || !Array.isArray(entry.flipped)) throw Error('着手履歴が不正です。');
    let result;
    try { result = applyMove(board, entry.cell, entry.side); }
    catch { throw Error('着手履歴に合法ではない手があります。'); }
    if (entry.flipped.length !== result.flipped.length || result.flipped.some((cell, i) => cell !== entry.flipped[i])) throw Error('裏返した石の履歴が一致しません。');
    board = result.board;
    turn = nextTurn(board, entry.side);
  }
  if (rows(board).some((row, i) => row !== state.rows[i])) throw Error('盤面と着手履歴が一致しません。');
  if (state.turn !== turn) throw Error('手番と着手履歴が一致しません。');
  const commandIds = new Set(), whiteRevisions = new Set();
  for (const receipt of state.receipts) {
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || typeof receipt.commandId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(receipt.commandId) || typeof receipt.cell !== 'string' || !/^[A-H][1-8]$/.test(receipt.cell) || !Number.isInteger(receipt.expectedRevision) || receipt.expectedRevision < 0 || receipt.expectedRevision >= state.revision || commandIds.has(receipt.commandId) || whiteRevisions.has(receipt.expectedRevision)) throw Error('白の応答記録が不正です。');
    const entry = state.history[receipt.expectedRevision];
    if (entry.side !== 'W' || entry.cell !== receipt.cell) throw Error('白の応答記録と着手履歴が一致しません。');
    commandIds.add(receipt.commandId);
    whiteRevisions.add(receipt.expectedRevision);
  }
  return state;
}
export function view(state) {
  validateSession(state);
  const flat = state.rows.join('');
  return { ...state, black: [...flat].filter(v => v === 'B').length, white: [...flat].filter(v => v === 'W').length, legalMoves: state.turn === 'finished' ? [] : legalMoves([...flat], state.turn) };
}
export function move(state, cell, side) {
  validateSession(state);
  if (state.turn !== side) throw Error('手番が違います。');
  const result = applyMove([...state.rows.join('')], cell, side);
  const turn = nextTurn(result.board, side);
  const next = { ...state, rows: rows(result.board), turn, revision: state.revision + 1, history: [...state.history, { side, cell, flipped: result.flipped, source: side === 'W' ? 'chat-gpt' : 'human' }] };
  return validateSession(next);
}
export function applyWhiteCommand(state, command) {
  validateSession(state);
  if (!command || command.gameId !== state.gameId || typeof command.commandId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(command.commandId)) throw Error('別対局または不正な白の応答です。');
  const existing = state.receipts.find(r => r.commandId === command.commandId);
  if (existing) {
    if (existing.cell !== command.cell || existing.expectedRevision !== command.expectedRevision) throw Error('応答IDが別の着手に再利用されています。');
    return state;
  }
  if (command.expectedRevision !== state.revision) throw Error('古い盤面への白の応答です。');
  const next = move(state, command.cell, 'W');
  next.receipts = [...next.receipts, { commandId: command.commandId, cell: command.cell, expectedRevision: command.expectedRevision }];
  return validateSession(next);
}
export function turnPrompt(state) {
  if (state.turn !== 'W') throw Error('白の手番ではありません。');
  const current = view(state);
  return '外部サーバーを使わないオセロの白の手番です。あなた自身が次の一手を考えてください。内蔵AIや外部生成AI APIで代用しないでください。新規対局は作らず、次の盤面をそのまま使ってください。\n' +
    JSON.stringify({ type: 'reversi-in-chat-white-turn', state, legalMoves: current.legalMoves }) + '\n' +
    '白の合法手を一つ選び、配布物の render_turn.py で表示中の game.html の gpt-reversi-bootstrap をこの state に、gpt-reversi-command を {gameId,expectedRevision,cell,commandId} に更新してください。expectedRevision は上記 revision、commandId は新しい英数字とハイフンのIDです。ルール処理と反映はHTML内のJavaScriptが行います。更新した同じHTMLを、最初に使ったChatGPT内の表示方法で再表示してください。初回にVisualizeで表示した場合は同じファイルのvisualize参照を返してください。別のMCPやサーバーを追加しないでください。通常の文章で手を回答するだけでは盤面は更新されません。追加の承認・再表示クリックが必要だった場合、黒クリックだけで成功したと扱わないでください。';
}
