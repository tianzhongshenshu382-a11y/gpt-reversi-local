import { randomUUID } from 'node:crypto';
import { initialBoard, legalMoves, applyMove } from './engine.mjs';

// A rules/state service only. White moves are supplied by the chat's model.
export class GameStore {
  games = new Map();
  create() {
    const now = Date.now();
    for (const [id, game] of this.games) if (now - game.updatedAt > 12 * 3600000) this.games.delete(id);
    if (this.games.size >= 100) throw Error('試作の対局数上限です。サーバーを再起動してください。');
    const game = { gameId: randomUUID(), board: initialBoard(), turn: 'B', revision: 0, history: [], commands: new Map(), updatedAt: now };
    this.games.set(game.gameId, game);
    return this.snapshot(game.gameId);
  }
  get(gameId) {
    const game = this.games.get(gameId);
    if (!game) throw Error('対局が見つかりません。ゲームを開き直してください。');
    return game;
  }
  snapshot(gameId) {
    const game = this.get(gameId);
    return {
      gameId, revision: game.revision, turn: game.turn,
      rows: Array.from({ length: 8 }, (_, y) => game.board.slice(y * 8, y * 8 + 8).join('')),
      black: game.board.filter(v => v === 'B').length,
      white: game.board.filter(v => v === 'W').length,
      legalMoves: game.turn === 'finished' ? [] : legalMoves(game.board, game.turn),
      history: game.history.map(entry => ({ ...entry, flipped: [...entry.flipped] })),
    };
  }
  move({ gameId, cell, expectedRevision, commandId }, side) {
    const game = this.get(gameId);
    const fingerprint = JSON.stringify([cell, expectedRevision, side]);
    const previous = game.commands.get(commandId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw Error('同じ着手IDを別の手に再利用できません。');
      return previous.result;
    }
    if (!commandId || typeof commandId !== 'string') throw Error('Missing commandId');
    if (game.revision !== expectedRevision) throw Error('盤面が更新されています。最新の盤面を読み直してください。');
    if (game.turn !== side) throw Error('手番が違います。');
    const next = applyMove(game.board, cell, side);
    game.board = next.board;
    game.revision++;
    game.updatedAt = Date.now();
    game.history.push({ revision: game.revision, side, cell, flipped: next.flipped, source: side === 'B' ? 'human-app-click' : 'chat-model' });
    const opponent = side === 'B' ? 'W' : 'B';
    game.turn = legalMoves(game.board, opponent).length ? opponent : legalMoves(game.board, side).length ? side : 'finished';
    const result = this.snapshot(gameId);
    game.commands.set(commandId, { fingerprint, result });
    return result;
  }
}
