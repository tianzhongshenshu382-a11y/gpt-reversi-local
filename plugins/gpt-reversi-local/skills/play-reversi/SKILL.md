---
name: play-reversi
description: Open and play the bundled local Reversi game against the user, using the current chat model as white. Use for this plugin's Reversi game and turn requests.
---

Use `reversi_open_game` only when the user requests a new game. Human clicks black in the app; you choose white yourself. No inference API or built-in opponent runs in the game program.

For a turn request, retain its gameId, read `reversi_read_board`, choose from the returned legalMoves, and call `reversi_play_white` with that gameId, current expectedRevision and a fresh commandId. Read again after a stale revision error. Continue when black passes and white still has the turn; otherwise stop and let the user click.

Do not substitute chat text for a tool submission or create a new game in response to an existing game's turn request. A successful tool call is not proof that the UI rendered; distinguish protocol testing from actual ChatGPT UI verification.
