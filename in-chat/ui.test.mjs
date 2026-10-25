// DOM/host mocks exercise our UI code; they do not verify ChatGPT integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { newSession, move } from './session.mjs';

function element() {
  return { textContent: '', dataset: {}, style: {}, children: [], hidden: false,
    append(child) { this.children.push(child); }, replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this[name] = value; },
  };
}
async function mount({ api = null, state = null, command = null } = {}) {
  const html = await readFile(new URL('./game.html', import.meta.url), 'utf8');
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const root = element();
  const elements = Object.fromEntries(['black','white','status','board','error','retry','detail','diagnostic'].map(name => [name, element()]));
  const blocks = { '#gpt-reversi-bootstrap': { textContent: JSON.stringify(state) }, '#gpt-reversi-command': { textContent: JSON.stringify(command) } };
  root.querySelector = selector => blocks[selector] ?? elements[selector.match(/data-rv="([^"]+)"/)[1]];
  const document = { getElementById: () => root, createElement: () => element() };
  const listeners = {};
  const window = { openai: api, addEventListener(name, handler) { listeners[name] = handler; } };
  new vm.Script(script).runInNewContext({ document, window, crypto: { randomUUID: () => 'ui-mock-game' } });
  return { root, elements, listeners };
}
test('a black click requests the chat with its exact post-move state', async () => {
  const requests = [];
  const { root, elements } = await mount({ api: { setWidgetState() {}, async sendFollowUpMessage(args) { requests.push(args); } } });
  elements.board.children.find(button => button['aria-label'] === 'D3 打てます').onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(root.dataset.revision, '1');
  assert.equal(root.dataset.turn, 'W');
  assert.equal(requests.length, 1);
  const payload = JSON.parse(requests[0].prompt.split('\n')[1]);
  assert.equal(payload.state.rows.join('/'), root.dataset.rows);
  assert.ok(payload.legalMoves.length);
  assert.equal(elements.board.children.filter(b => !b.disabled).length, 0);
  assert.equal(elements.retry.hidden, false);
});
test('a restored white turn offers recovery without silently resending an existing request', async () => {
  const restoredState = move(newSession('restored-ui'), 'D3', 'B');
  const requests = [];
  const { root, elements, listeners } = await mount({ api: {
    widgetState: { privateContent: { reversi: restoredState } },
    async sendFollowUpMessage(args) { requests.push(args); },
  } });
  assert.equal(root.dataset.turn, 'W');
  assert.equal(elements.retry.hidden, false);
  assert.equal(requests.length, 0);
  elements.retry.onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  listeners['openai:set_globals']({ detail: { globals: { widgetState: { privateContent: { reversi: newSession('restored-ui') } } } } });
  assert.equal(root.dataset.revision, '1', 'older host state must not undo a move');
  listeners['openai:set_globals']({ detail: { globals: { widgetState: { privateContent: { reversi: newSession('different-ui') } } } } });
  assert.equal(root.dataset.gameId, 'restored-ui', 'late state from a different game must not replace this board');
});
test('a missing host bridge reports failure, never simulates an AI turn', async () => {
  const { root, elements } = await mount();
  elements.board.children.find(button => button['aria-label'] === 'D3 打てます').onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(elements.error.textContent, /自動応答は成立していません/);
  assert.equal(root.dataset.revision, '1');
  assert.equal(root.dataset.turn, 'W');
});
test('a returned white command is applied by the rendered JavaScript', async () => {
  const state = move(newSession('ui-white-test'), 'D3', 'B');
  const { root, elements } = await mount({ state, command: { gameId: state.gameId, expectedRevision: 1, cell: 'C5', commandId: 'synthetic-white' } });
  assert.equal(root.dataset.revision, '2');
  assert.equal(root.dataset.turn, 'B');
  assert.equal(elements.black.textContent, 3);
  assert.equal(elements.white.textContent, 3);
  assert.equal(elements.error.textContent, '');
});
