import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GameStore } from './game.mjs';
import { createMcpServer, loadHtml } from './server.mjs';

// stdout is reserved for MCP. No tunnels, HTTP listener or inference API.
const server = createMcpServer(new GameStore(), await loadHtml());
await server.connect(new StdioServerTransport());
