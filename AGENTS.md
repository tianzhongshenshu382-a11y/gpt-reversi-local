# GPT Reversi local distribution

This repository packages the Reversi test for the recipient's own Windows PC. Read README.md for setup and supported connection paths.

- Preserve the separation between local rules/state and the current chat model's choice of white moves. Do not add a conventional opponent or inference API to simulate GPT integration.
- All paths must be relative to this downloaded package. Do not reuse an author's endpoint, absolute path, account, or installed runtime.
- Never commit `.runtime`, `.local`, `node_modules`, personal connection URLs or chat history.
- A URL pasted into chat does not establish access to the recipient's PC. Check available local execution and host integration before offering to automate installation. The receiving user's request and host permissions determine what may be installed or connected.
- Protocol tests with a synthetic white move are not actual GPT/UI tests. Record real host rendering and automatic response separately.
