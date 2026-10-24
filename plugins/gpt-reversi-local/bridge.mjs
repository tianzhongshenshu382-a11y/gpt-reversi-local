export function createBridge(onResult, diagnostic = () => {}) {
  const pending = new Map();
  let id = 0, targetOrigin = '*', connected = false, capabilities = {};
  const request = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => { pending.delete(requestId); reject(Error('ChatGPTへの接続がタイムアウトしました。')); }, 15000);
    pending.set(requestId, { resolve, reject, timeout });
    window.parent.postMessage({ jsonrpc: '2.0', id: requestId, method, params }, targetOrigin);
  });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || !event.data || event.data.jsonrpc !== '2.0') return;
    if (targetOrigin !== '*' && event.origin !== targetOrigin) return;
    const message = event.data;
    if (pending.has(message.id)) {
      const waiter = pending.get(message.id); pending.delete(message.id); clearTimeout(waiter.timeout);
      if (message.error) waiter.reject(Error(message.error.message || '接続エラー'));
      else { if (event.origin && event.origin !== 'null') targetOrigin = event.origin; waiter.resolve(message.result); }
    } else if (message.method === 'ui/notifications/tool-result') onResult(message.params);
  });
  return {
    get connected() { return connected; },
    get canMessage() { return connected && !!capabilities.message; },
    async connect() {
      if (window.parent === window) throw Error('ChatGPTに追加したアプリから開いてください。');
      const init = await request('ui/initialize', { appInfo: { name: 'gpt-reversi', version: '0.1.0' }, appCapabilities: { availableDisplayModes: ['inline', 'pip', 'fullscreen'] }, protocolVersion: '2026-01-26' });
      capabilities = init?.hostCapabilities || {};
      diagnostic({ event: 'host-ready', message: !!capabilities.message });
      connected = true;
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, targetOrigin);
      if (!capabilities.message) throw Error('この画面ではChatGPTへの自動依頼を利用できません。');
    },
    callTool(name, args) { return request('tools/call', { name, arguments: args }); },
    async sendMessage(prompt) {
      diagnostic({ event: 'turn-request', method: 'ui/message' });
      const result = await request('ui/message', { role: 'user', content: [{ type: 'text', text: prompt }] });
      diagnostic({ event: 'turn-request-returned', method: 'ui/message', result: result ?? null });
      return result;
    },
  };
}
