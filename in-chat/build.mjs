import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const read = p => readFile(new URL(p, import.meta.url), 'utf8');
const stripExports = source => source.replace(/^export /gm, '');
const engine = stripExports(await read('./engine.mjs'));
const session = stripExports((await read('./session.mjs')).replace(/^import .*;\r?\n/m, ''));
const ui = await read('./ui.js');
const html = (await read('./game.template.html')).replace('/* INLINE_ENGINE */', () => engine).replace('/* INLINE_SESSION */', () => session).replace('/* INLINE_UI */', () => '"use strict";\n' + (ui));
// Read before writing; no external assets, imports, server URL, or API calls.
if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|trycloudflare|localhost:|\/api\/mcp|<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=|\bimport\s*\(/i.test(html)) throw Error('Network/server dependency found');
await writeFile(new URL('./game.html', import.meta.url), html);
const runtimeFiles = ['game.html', 'render_turn.py'];
const files = [];
for (const name of runtimeFiles) {
  const data = await readFile(new URL(name, import.meta.url));
  files.push({ path: name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
await writeFile(new URL('./manifest.json', import.meta.url), JSON.stringify({
  name: 'reversi-in-chat', version: '0.1.1', status: 'host-confirmation-required',
  entry: 'START.md', runtimeFiles: files, externalGameServer: false,
  inferenceApi: false, builtInOpponent: false,
  requiredHostFeatures: ['interactive HTML with JavaScript', 'window.openai.sendFollowUpMessage', 'same-chat HTML redisplay after a GPT turn'],
  verifiedOnWebChatGPT: {
    boardDisplay: true, testedDisplayMode: 'inline',
    hostConfirmationShownAfterBlackMove: true,
    whiteMoveChosenAfterConfirmation: true, whiteMoveAppliedToBoard: true,
    whiteMoveVisibleOnlyAfterManualReload: true,
    basicPromptOnlyFollowUpAlsoRequiredConfirmation: true,
    widgetStatePersistenceWorkedInLatestProbe: false,
    automaticWhiteTurn: false, rightPaneAutoUpdate: false,
    latestWhiteRenderError: 'TimeoutError: MCP sandbox RPC timed out.',
  },
}, null, 2) + '\n');
console.log(`Built in-chat game.html (${Buffer.byteLength(html)} bytes), no runtime dependencies`);
