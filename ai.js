// A depth-limited minimax (negamax + alpha-beta pruning) chess AI.
// Built on top of the pure rules engine in chess-engine.js.
(function () {
  const { getAllLegalMoves, applyMove, isInCheck } = window.ChessEngine;

  const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

  // Piece-square tables (row 0 = rank 1, matching the engine's board layout).
  // Encourage pawns to advance and knights to stay central rather than on the rim.
  const PAWN_TABLE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 5, 5, -10, -10, 5, 5, 5],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const KNIGHT_TABLE = [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ];

  function centerBonus(r, c) {
    return 4 - (Math.abs(r - 3.5) + Math.abs(c - 3.5));
  }

  // Positive score = good for White.
  function evaluateBoard(state) {
    let score = 0;
    const { board } = state;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const color = p[0];
        const type = p[1];
        let value = PIECE_VALUES[type];
        const row = color === 'w' ? r : 7 - r;
        if (type === 'P') value += PAWN_TABLE[row][c];
        else if (type === 'N') value += KNIGHT_TABLE[row][c];
        else value += centerBonus(r, c);
        score += color === 'w' ? value : -value;
      }
    }
    return score;
  }

  function orderMoves(moves) {
    return moves.slice().sort((a, b) => (b.flags.capture ? 1 : 0) - (a.flags.capture ? 1 : 0));
  }

  function negamax(state, depth, alpha, beta) {
    const moves = getAllLegalMoves(state, state.turn);
    if (moves.length === 0) {
      return isInCheck(state, state.turn) ? -99999 : 0; // checkmate : stalemate
    }
    if (depth === 0) {
      const raw = evaluateBoard(state);
      return state.turn === 'w' ? raw : -raw;
    }

    let best = -Infinity;
    for (const move of orderMoves(moves)) {
      const child = applyMove(state, move, 'Q');
      const score = -negamax(child, depth - 1, -beta, -alpha);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break; // prune
    }
    return best;
  }

  const DIFFICULTY_SETTINGS = {
    easy: { depth: 1, randomness: 0.6 },
    medium: { depth: 2, randomness: 0.15 },
    hard: { depth: 3, randomness: 0 },
    impossible: { depth: 4, randomness: 0 },
  };

  function getBestMove(state, difficulty) {
    const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.medium;
    const moves = getAllLegalMoves(state, state.turn);
    if (moves.length === 0) return null;

    if (Math.random() < settings.randomness) {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    const ordered = orderMoves(moves);
    let bestMove = ordered[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;
    for (const move of ordered) {
      const child = applyMove(state, move, 'Q');
      const score = -negamax(child, settings.depth - 1, -beta, -alpha);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (bestScore > alpha) alpha = bestScore;
    }
    return bestMove;
  }

  window.ChessAI = { getBestMove };
})();
