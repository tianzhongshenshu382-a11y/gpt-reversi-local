# In-chat Reversi

- User requires: GitHub URL → Web ChatGPT → game in right pane → black click starts this chat's GPT's white turn.
- No external game server, MCP server, localhost process, tunnel, inference API, or built-in opponent AI.
- Keep `reversi-local-distribution` and the public repo's existing local plugin unchanged as a verified success.
- Rules, validation, turn, score, and board live in the HTML's JavaScript. The chat model chooses white.
- A response from GPT may update the HTML's white-command JSON using the stateless `render_turn.py` helper in ChatGPT's normal file workspace. This helper is not a running server and does not choose a move.
- Never claim black-click-only automation based on mocked host APIs. Test the real Web ChatGPT host, recording confirmations, replacement widgets, and any required refresh.
- If the host does not supply a supported follow-up or update path, report the exact missing capability. Do not introduce a server as a fallback.
