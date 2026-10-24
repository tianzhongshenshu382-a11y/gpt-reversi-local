import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { GameStore } from './game.mjs';

export const URI = 'ui://gpt-reversi/board-distribution-v021.html';
const boardSchema = {
  gameId: z.string().uuid(), revision: z.number().int(), turn: z.enum(['B', 'W', 'finished']),
  rows: z.array(z.string()).length(8), black: z.number().int(), white: z.number().int(), legalMoves: z.array(z.string()),
  history: z.array(z.object({ revision: z.number().int(), side: z.enum(['B', 'W']), cell: z.string(), flipped: z.array(z.string()), source: z.string() })),
};
const gameInput = { gameId: z.string().uuid() };
const moveInput = { ...gameInput, cell: z.string().regex(/^[A-H][1-8]$/), expectedRevision: z.number().int().nonnegative(), commandId: z.string().min(1).max(100) };
const result = state => ({ content: [{ type: 'text', text: JSON.stringify(state) }], structuredContent: state });
const guarded = action => async args => {
  try { return result(action(args)); }
  catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
};

export function createMcpServer(store, html) {
  const server = new McpServer({ name: 'GPT対戦オセロ・各自PC版', version: '0.2.1' }, {
    instructions: 'Human plays black by clicking the app. When the app sends a turn request, read that game with reversi_read_board, choose a legal white move yourself, and submit it with reversi_play_white using the observed revision and a new commandId. Continue only if white still has the turn because black passed. Stop once black has the turn or the game finishes. There is no opponent AI or inference API in this server. Do not create a new game on a turn request.',
  });
  registerAppResource(server, 'reversi-board', URI, {}, async () => ({ contents: [{
    uri: URI, mimeType: RESOURCE_MIME_TYPE, text: html,
    _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } }, 'openai/widgetDescription': '黒はユーザー、白はこのチャットのGPT。黒の着手後に自動でGPTへ手番を依頼するオセロ盤。' },
  }] }));
  const common = { outputSchema: boardSchema, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } };
  registerAppTool(server, 'reversi_open_game', {
    ...common, title: 'オセロを開く', description: 'Start a new Othello game and display its board. Human is black, GPT is white. Only call when a new game is requested.', inputSchema: {},
    _meta: { ui: { resourceUri: URI, visibility: ['model'] } },
  }, guarded(() => store.create()));
  registerAppTool(server, 'reversi_read_board', {
    ...common, title: '盤面を読む', description: 'Read this game, legal moves and revision. Choose a legal white move yourself when turn is W.', inputSchema: gameInput,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, _meta: { ui: { visibility: ['model', 'app'] } },
  }, guarded(({ gameId }) => store.snapshot(gameId)));
  registerAppTool(server, 'reversi_human_move', {
    ...common, title: '黒を打つ', description: 'Apply the human black move selected in the app.', inputSchema: moveInput,
    _meta: { ui: { visibility: ['app'] } },
  }, guarded(args => store.move(args, 'B')));
  registerAppTool(server, 'reversi_play_white', {
    ...common, title: 'GPTが白を打つ', description: 'Submit a legal white move chosen by this chat GPT. First read the current board. If black passes and turn remains W, choose another move. Stop when turn is B or finished.', inputSchema: moveInput,
    _meta: { ui: { visibility: ['model'] } },
  }, guarded(args => store.move(args, 'W')));
  return server;
}

export async function startServer({ port = 0, host = '127.0.0.1', enableTestHarness = false } = {}) {
  const store = new GameStore();
  const html = await loadHtml();
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ name: 'gpt-reversi-local', version: '0.2.1', inferenceApi: false })); return;
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('GPT Reversi MCP test server. Endpoint: /mcp. No inference API. Games are temporary.'); return;
    }
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    if (enableTestHarness && req.method === 'GET' && url.pathname === '/test-harness') {
      const harness = await readFile(new URL('test-harness.html', import.meta.url), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(harness); return;
    }
    if (enableTestHarness && req.method === 'GET' && url.pathname === '/test-board') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html); return;
    }
    if (url.pathname !== '/mcp') { res.writeHead(404).end(); return; }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Accept,Mcp-Session-Id,MCP-Protocol-Version' }).end(); return;
    }
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) { res.writeHead(405).end(); return; }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    const mcp = createMcpServer(store, html);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); mcp.close(); });
    try { await mcp.connect(transport); await transport.handleRequest(req, res); }
    catch { if (!res.headersSent) res.writeHead(500).end('MCP request failed'); }
  });
  await new Promise((resolve, reject) => { httpServer.once('error', reject); httpServer.listen(port, host, resolve); });
  return { httpServer, store, url: `http://${host}:${httpServer.address().port}` };
}

export async function loadHtml() {
  const source = await readFile(new URL('board.html', import.meta.url), 'utf8');
  const handoff = await readFile(new URL('handoff.mjs', import.meta.url), 'utf8');
  const bridge = await readFile(new URL('bridge.mjs', import.meta.url), 'utf8');
  // All app assets are inline; the sandbox needs no network fetch permission.
  const html = source.replace('/* INLINE_HANDOFF */', handoff.replaceAll('export ', '')).replace('/* INLINE_BRIDGE */', bridge.replaceAll('export ', ''));
  return html;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const instance = await startServer({ port: Number(process.env.REVERSI_PORT || 8788), enableTestHarness: process.argv.includes('--test-harness') });
  console.log(JSON.stringify({ url: instance.url, mcp: `${instance.url}/mcp`, testHarness: process.argv.includes('--test-harness'), inferenceApi: false }));
}
