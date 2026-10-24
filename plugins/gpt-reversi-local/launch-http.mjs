import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { startServer } from './server.mjs';

const runtimeDir = new URL('./.runtime/', import.meta.url);
const localDir = new URL('./.local/', import.meta.url);
const cloudExe = new URL('cloudflared-2026.10.3.exe', runtimeDir);
const expectedHash = '76b2805253d0d6ffacb092a7acfbee99e7af6917835c0c5410e23f3ef5052da2';
await mkdir(runtimeDir, { recursive: true });
await mkdir(localDir, { recursive: true });
try { await access(cloudExe); }
catch {
  console.log('Downloading official Cloudflare Tunnel (game endpoint only)...');
  const response = await fetch('https://github.com/cloudflare/cloudflared/releases/download/2026.10.3/cloudflared-windows-amd64.exe');
  if (!response.ok) throw Error(`Cloudflare download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw Error('Cloudflare checksum mismatch. Not executed.');
  const temporary = new URL('cloudflared-download.part', runtimeDir);
  await writeFile(temporary, bytes);
  await rename(temporary, cloudExe);
}
if (createHash('sha256').update(await readFile(cloudExe)).digest('hex') !== expectedHash) throw Error('Cloudflare checksum mismatch. Not executed.');
const instance = await startServer();
const tunnel = spawn(fileURLToPath(cloudExe), ['tunnel', '--url', instance.url, '--no-autoupdate'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
console.log(`Local game: ${instance.url}   (close this window to stop)`);
let endpoint;
const startup = setTimeout(() => { console.error('Tunnel did not become ready. Check your network, then restart.'); stop(1); }, 60000);
async function log(chunk) {
  const line = String(chunk);
  const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match && !endpoint) {
    endpoint = `${match[0]}/mcp`;
    clearTimeout(startup);
    await writeFile(new URL('connection.json', localDir), JSON.stringify({ localEndpoint: `${instance.url}/mcp`, endpoint, temporary: true, inferenceApiUsed: false, version: '0.2.1' }, null, 2));
    console.log(`\nChatGPT MCP URL: ${endpoint}\nAuthentication: None\nName: GPT Reversi - own PC test\n\nAdd this URL as a custom MCP server in your own ChatGPT.\nThe old author's URL is never used. Restarting changes this temporary URL.`);
  }
}
tunnel.stdout.on('data', log);
tunnel.stderr.on('data', chunk => { log(chunk).catch(error => { console.error(error.message); stop(1); }); });
tunnel.on('error', error => { console.error(error.message); stop(1); });
tunnel.on('exit', code => { if (code) console.error(`Tunnel exited: ${code}`); stop(code || 0); });
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(startup);
  tunnel.kill();
  instance.httpServer.close();
  setTimeout(() => process.exit(code), 100).unref();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
