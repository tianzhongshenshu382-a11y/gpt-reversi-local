import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newSession, view, move, applyWhiteCommand, turnPrompt, validateSession } from './session.mjs';

test('the UI owns rules; white is a validated, idempotent command from the chat', () => {
  const initial = newSession('test-game');
  assert.deepEqual(view(initial).legalMoves, ['D3','C4','F5','E6']);
  assert.throws(() => move(initial, 'A1', 'B'), /Illegal/);
  const black = move(initial, 'D3', 'B');
  assert.equal(black.turn, 'W');
  const command = { gameId: black.gameId, expectedRevision: 1, cell: 'C5', commandId: 'white-1' };
  const white = applyWhiteCommand(black, command);
  assert.equal(white.turn, 'B');
  assert.equal(view(white).black, 3);
  assert.equal(view(white).white, 3);
  assert.deepEqual(applyWhiteCommand(white, command), white);
  assert.throws(() => applyWhiteCommand(white, { ...command, cell: 'E3' }), /再利用/);
  assert.throws(() => applyWhiteCommand(white, { ...command, commandId: 'other' }), /古い/);
  assert.throws(() => applyWhiteCommand(black, { ...command, gameId: 'other' }), /別対局/);
  assert.equal(initial.revision, 0);
  assert.ok(turnPrompt(black).includes('"revision":1'));
  assert.ok(!turnPrompt(black).includes('http'));
});

test('snapshots must replay from the initial board with exact legal history and turn', () => {
  const black = move(newSession('replay-validation'), 'D3', 'B');
  const white = move(black, 'C5', 'W');
  // Direct white moves are also used before a receipt is appended.
  assert.equal(validateSession(white), white);
  assert.deepEqual(white.receipts, []);
  const corruptions = [
    state => { state.history[0] = null; },
    state => { state.history[0] = []; },
    state => { state.history[0].side = 'W'; },
    state => { state.history[0].source = 'chat-gpt'; },
    state => { state.history[0].cell = 'A1'; },
    state => { state.history[0].flipped = ['E4']; },
    state => { state.history[0].flipped = Array(1); },
    state => { state.history[0].flipped = null; },
    state => { state.rows[0] = 'B.......'; },
    state => { state.rows[0] = null; },
    state => { state.turn = 'W'; },
    state => { state.turn = 'finished'; },
    state => { state.revision = 1; },
  ];
  for (const corrupt of corruptions) {
    const state = structuredClone(white);
    corrupt(state);
    assert.throws(() => validateSession(state), error => error.constructor === Error);
  }
});

test('white receipts are unique and must identify an actual white history entry', () => {
  const black = move(newSession('receipt-validation'), 'D3', 'B');
  const command = { gameId: black.gameId, expectedRevision: 1, cell: 'C5', commandId: 'receipt-1' };
  const white = applyWhiteCommand(black, command);
  assert.equal(validateSession(white), white);
  const corruptions = [
    state => { state.receipts = [null]; },
    state => { state.receipts = [[]]; },
    state => { state.receipts[0].commandId = null; },
    state => { state.receipts[0].commandId = 'invalid ID'; },
    state => { state.receipts.push({ ...state.receipts[0] }); },
    state => { state.receipts.push({ ...state.receipts[0], commandId: 'different-id' }); },
    state => { state.receipts[0].expectedRevision = 0; state.receipts[0].cell = 'D3'; },
    state => { state.receipts[0].expectedRevision = 2; },
    state => { state.receipts[0].expectedRevision = '1'; },
    state => { state.receipts[0].cell = 'E3'; },
  ];
  for (const corrupt of corruptions) {
    const state = structuredClone(white);
    corrupt(state);
    assert.throws(() => validateSession(state), error => error.constructor === Error);
    assert.throws(() => applyWhiteCommand(state, command), error => error.constructor === Error);
  }
  assert.deepEqual(applyWhiteCommand(white, command), white);
});

test('legal play reaches finished positions with conserved counts and pass handling', () => {
  let passSeen = false;
  for (let seed = 1; seed <= 30; seed++) {
    let state = newSession('game-' + seed), n = seed;
    while (state.turn !== 'finished') {
      const before = view(state), side = state.turn;
      n = (n * 1664525 + 1013904223) >>> 0;
      state = move(state, before.legalMoves[n % before.legalMoves.length], side);
      const next = view(state);
      assert.equal(next.black + next.white, 4 + state.revision);
      if (state.turn === side) passSeen = true;
      assert.ok(state.revision <= 60);
    }
    assert.ok(state.revision > 0);
  }
  assert.ok(passSeen);
});

test('distributed HTML has no game-service URL, network runtime, or bundled opponent', async () => {
  const html = await readFile(new URL('./game.html', import.meta.url), 'utf8');
  assert.ok(html.includes('function applyWhiteCommand'));
  assert.ok(html.includes('window.openai.sendFollowUpMessage'));
  assert.ok(html.includes('gpt-reversi-bootstrap'));
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|WebSocket|trycloudflare|localhost:|\/api\/mcp|INLINE_/);
  assert.doesNotMatch(html, /minimax|alphaBeta|OPENAI_API_KEY/);
});
