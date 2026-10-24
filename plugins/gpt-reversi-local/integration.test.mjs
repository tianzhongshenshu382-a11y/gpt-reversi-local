import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startServer, URI } from './server.mjs';
import { createHandoff } from './handoff.mjs';

test('MCP protocol: app resource, roles, black/white moves, revision guard and independent games', async () => {
  const instance = await startServer();
  const client = new Client({ name: 'reversi-integration-test', version: '0.1.0' }, { capabilities: {} });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`${instance.url}/mcp`)));
    const { tools } = await client.listTools();
    assert.deepEqual(tools.find(t => t.name === 'reversi_human_move')._meta.ui.visibility, ['app']);
    assert.deepEqual(tools.find(t => t.name === 'reversi_play_white')._meta.ui.visibility, ['model']);
    const resource = await client.readResource({ uri: URI });
    assert.match(resource.contents[0].mimeType, /mcp-app/);
    assert.match(resource.contents[0].text, /ui\/message/);
    assert.doesNotMatch(resource.contents[0].text, /INLINE_HANDOFF|INLINE_BRIDGE|api\.openai/);
    const game = (await client.callTool({ name: 'reversi_open_game', arguments: {} })).structuredContent;
    const other = (await client.callTool({ name: 'reversi_open_game', arguments: {} })).structuredContent;
    assert.notEqual(game.gameId, other.gameId);
    assert.deepEqual(game.legalMoves, ['D3', 'C4', 'F5', 'E6']);
    const args = { gameId: game.gameId, expectedRevision: 0, cell: 'D3', commandId: 'test-black-1' };
    const black = (await client.callTool({ name: 'reversi_human_move', arguments: args })).structuredContent;
    assert.equal(black.revision, 1); assert.equal(black.turn, 'W'); assert.equal(black.black, 4);
    assert.deepEqual((await client.callTool({ name: 'reversi_human_move', arguments: args })).structuredContent, black);
    const stale = await client.callTool({ name: 'reversi_play_white', arguments: { ...args, cell: 'C3', commandId: 'stale-white' } });
    assert.equal(stale.isError, true);
    const illegal = await client.callTool({ name: 'reversi_play_white', arguments: { ...args, expectedRevision: 1, cell: 'A1', commandId: 'illegal-white' } });
    assert.equal(illegal.isError, true);
    // Synthetic test input, not an AI move or evidence that a host started GPT.
    const white = (await client.callTool({ name: 'reversi_play_white', arguments: { ...args, expectedRevision: 1, cell: 'C3', commandId: 'test-white-1' } })).structuredContent;
    assert.equal(white.revision, 2); assert.equal(white.turn, 'B'); assert.equal(white.white, 3);
    const untouched = (await client.callTool({ name: 'reversi_read_board', arguments: { gameId: other.gameId } })).structuredContent;
    assert.equal(untouched.revision, 0);
    const missing = await client.callTool({ name: 'reversi_read_board', arguments: { gameId: '00000000-0000-4000-8000-000000000000' } });
    assert.equal(missing.isError, true);
  } finally { await client.close(); await new Promise(resolve => instance.httpServer.close(resolve)); }
});

test('click handoff: save black first, send one message, ignore double clicks', async () => {
  const events = [], errors = [];
  let resolveMove;
  const state = { gameId: 'test-game', revision: 0, turn: 'B', legalMoves: ['D3'] };
  const next = { ...state, revision: 1, turn: 'W', legalMoves: ['C3'] };
  const handoff = createHandoff({
    callTool: async () => { events.push('save'); return await new Promise(resolve => { resolveMove = resolve; }); },
    sendMessage: async prompt => { assert.match(prompt, /test-game/); events.push('message'); return {}; },
    update: () => events.push('display'), setBusy: () => {}, onError: error => errors.push(error),
  });
  const first = handoff.play(state, 'D3');
  await handoff.play(state, 'D3');
  assert.deepEqual(events, ['save']);
  resolveMove({ structuredContent: next }); await first;
  assert.deepEqual(events, ['save', 'display', 'message']); assert.equal(errors.length, 0);
});

test('rejected delivery: black stays saved, no silent retry, explicit retry sends no extra move', async () => {
  let moves = 0, messages = 0, error;
  const state = { gameId: 'test-game', revision: 0, turn: 'B', legalMoves: ['D3'] };
  const next = { ...state, turn: 'W', revision: 1 };
  const handoff = createHandoff({
    callTool: async () => { moves++; return { structuredContent: next }; },
    sendMessage: async () => { messages++; return { isError: messages === 1 }; },
    update: () => {}, setBusy: () => {}, onError: e => { error = e; },
  });
  await handoff.play(state, 'D3');
  assert.match(error.message, /受け付けません/); assert.equal(moves, 1); assert.equal(messages, 1);
  await handoff.retry(next); assert.equal(moves, 1); assert.equal(messages, 2);
});
