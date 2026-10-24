import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';

test('packaged stdio command starts the bundled runtime from the declared manifest', { skip: process.platform !== 'win32' }, async () => {
  const root = fileURLToPath(new URL('./', import.meta.url));
  const config = JSON.parse(await readFile(new URL('./mcp.json', import.meta.url), 'utf8')).mcpServers['reversi-local'];
  const resolve = text => text.replaceAll('${PLUGIN_ROOT}', root);
  const client = new Client({ name: 'manifest-launch-test', version: '0.2.1' }, { capabilities: {} });
  try {
    await client.connect(new StdioClientTransport({ command: config.command, args: config.args.map(resolve), cwd: resolve(config.cwd), stderr: 'pipe' }));
    const result = await client.callTool({ name: 'reversi_open_game', arguments: {} });
    assert.equal(result.structuredContent.revision, 0);
    assert.equal(result.structuredContent.turn, 'B');
  } finally { await client.close(); }
});

test('separate recipient processes: stdio works from an unrelated cwd, UI is self-contained, games are private to each process', async () => {
  const connections = [];
  try {
    for (let i = 0; i < 2; i++) {
      const client = new Client({ name: `recipient-${i}`, version: '0.2.1' }, { capabilities: {} });
      const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./stdio.mjs', import.meta.url))], cwd: tmpdir(), stderr: 'pipe' });
      connections.push(client);
      await client.connect(transport);
    }
    const [first, second] = connections;
    const tools = (await first.listTools()).tools;
    const ui = tools.find(t => t.name === 'reversi_open_game')._meta.ui.resourceUri;
    const resource = (await first.readResource({ uri: ui })).contents[0];
    assert.match(resource.mimeType, /mcp-app/);
    assert.match(resource.text, /ui\/message/);
    assert.doesNotMatch(resource.text, /INLINE_HANDOFF|INLINE_BRIDGE|trycloudflare\.com|sendFollowUpMessage/);
    const a = (await first.callTool({ name: 'reversi_open_game', arguments: {} })).structuredContent;
    const b = (await second.callTool({ name: 'reversi_open_game', arguments: {} })).structuredContent;
    assert.notEqual(a.gameId, b.gameId);
    const foreignGame = await second.callTool({ name: 'reversi_read_board', arguments: { gameId: a.gameId } });
    assert.equal(foreignGame.isError, true);
    const black = (await first.callTool({ name: 'reversi_human_move', arguments: { gameId: a.gameId, cell: 'D3', expectedRevision: 0, commandId: 'recipient-a-black-1' } })).structuredContent;
    assert.equal(black.turn, 'W');
    // Test-supplied input checks the transport; it is not an actual GPT decision.
    const white = (await first.callTool({ name: 'reversi_play_white', arguments: { gameId: a.gameId, cell: 'C5', expectedRevision: 1, commandId: 'synthetic-white-1' } })).structuredContent;
    assert.equal(white.turn, 'B');
    assert.equal(white.revision, 2);
    assert.equal((await second.callTool({ name: 'reversi_read_board', arguments: { gameId: b.gameId } })).structuredContent.revision, 0);
  } finally { await Promise.all(connections.map(c => c.close())); }
});
