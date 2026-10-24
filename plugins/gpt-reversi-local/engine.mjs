export const files = 'ABCDEFGH';
export function initialBoard() {
  const b = Array(64).fill('.');
  b[27] = b[36] = 'W'; b[28] = b[35] = 'B';
  return b;
}
export function flips(board, index, side) {
  if (board[index] !== '.') return [];
  const x = index % 8, y = Math.floor(index / 8), enemy = side === 'B' ? 'W' : 'B';
  const result = [];
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
    let cx = x + dx, cy = y + dy, line = [];
    while (cx >= 0 && cx < 8 && cy >= 0 && cy < 8 && board[cy * 8 + cx] === enemy) {
      line.push(cy * 8 + cx); cx += dx; cy += dy;
    }
    if (line.length && cx >= 0 && cx < 8 && cy >= 0 && cy < 8 && board[cy * 8 + cx] === side) result.push(...line);
  }
  return result;
}
export function cellName(index) { return files[index % 8] + (Math.floor(index / 8) + 1); }
export function cellIndex(cell) {
  if (!/^[A-H][1-8]$/.test(cell)) throw Error('Invalid cell');
  return (Number(cell[1]) - 1) * 8 + files.indexOf(cell[0]);
}
export function legalMoves(board, side) {
  return board.flatMap((_, i) => flips(board, i, side).length ? [cellName(i)] : []);
}
export function applyMove(board, cell, side) {
  const i = cellIndex(cell), captured = flips(board, i, side);
  if (!captured.length) throw Error('Illegal move: ' + cell);
  const next = board.slice(); next[i] = side; captured.forEach(j => { next[j] = side; });
  return { board: next, flipped: captured.map(cellName) };
}
