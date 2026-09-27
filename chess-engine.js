// Pure chess rules engine: no DOM access, so it's easy to test or reuse.
(function () {
  function createInitialBoard() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      board[0][c] = 'w' + backRank[c];
      board[1][c] = 'wP';
      board[6][c] = 'bP';
      board[7][c] = 'b' + backRank[c];
    }
    return board;
  }

  function createInitialState() {
    return {
      board: createInitialBoard(),
      turn: 'w',
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      enPassant: null,
      kingPos: { w: { r: 0, c: 4 }, b: { r: 7, c: 4 } },
    };
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function pieceColor(p) {
    return p ? p[0] : null;
  }
  function pieceType(p) {
    return p ? p[1] : null;
  }

  const DIRS = {
    B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    Q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
  };
  const KNIGHT_OFFSETS = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
  const KING_OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  function getAttackSquares(board, color) {
    const attacks = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || pieceColor(p) !== color) continue;
        const type = pieceType(p);
        if (type === 'P') {
          const dir = color === 'w' ? 1 : -1;
          for (const dc of [1, -1]) {
            const nr = r + dir, nc = c + dc;
            if (inBounds(nr, nc)) attacks.add(nr + ',' + nc);
          }
        } else if (type === 'N') {
          for (const [dr, dc] of KNIGHT_OFFSETS) {
            const nr = r + dr, nc = c + dc;
            if (inBounds(nr, nc)) attacks.add(nr + ',' + nc);
          }
        } else if (type === 'K') {
          for (const [dr, dc] of KING_OFFSETS) {
            const nr = r + dr, nc = c + dc;
            if (inBounds(nr, nc)) attacks.add(nr + ',' + nc);
          }
        } else if (DIRS[type]) {
          for (const [dr, dc] of DIRS[type]) {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
              attacks.add(nr + ',' + nc);
              if (board[nr][nc]) break;
              nr += dr;
              nc += dc;
            }
          }
        }
      }
    }
    return attacks;
  }

  function isSquareAttacked(board, r, c, byColor) {
    return getAttackSquares(board, byColor).has(r + ',' + c);
  }

  function getPseudoMoves(state, r, c) {
    const { board } = state;
    const p = board[r][c];
    if (!p) return [];
    const color = pieceColor(p), type = pieceType(p);
    const moves = [];

    function addMove(nr, nc, flags) {
      moves.push({ from: { r, c }, to: { r: nr, c: nc }, flags: flags || {} });
    }

    if (type === 'P') {
      const dir = color === 'w' ? 1 : -1;
      const startRow = color === 'w' ? 1 : 6;
      const promoRow = color === 'w' ? 7 : 0;
      if (inBounds(r + dir, c) && !board[r + dir][c]) {
        addMove(r + dir, c, { promotion: r + dir === promoRow });
        if (r === startRow && !board[r + 2 * dir][c]) {
          addMove(r + 2 * dir, c, { doubleStep: true });
        }
      }
      for (const dc of [1, -1]) {
        const nr = r + dir, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr][nc];
        if (target && pieceColor(target) !== color) {
          addMove(nr, nc, { capture: true, promotion: nr === promoRow });
        } else if (!target && state.enPassant && state.enPassant.r === nr && state.enPassant.c === nc) {
          addMove(nr, nc, { capture: true, enPassant: true });
        }
      }
    } else if (type === 'N') {
      for (const [dr, dc] of KNIGHT_OFFSETS) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr][nc];
        if (!target || pieceColor(target) !== color) addMove(nr, nc, { capture: !!target });
      }
    } else if (type === 'K') {
      for (const [dr, dc] of KING_OFFSETS) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr][nc];
        if (!target || pieceColor(target) !== color) addMove(nr, nc, { capture: !!target });
      }
      const rights = state.castling;
      const row = color === 'w' ? 0 : 7;
      if (r === row && c === 4) {
        const oppColor = color === 'w' ? 'b' : 'w';
        const attacked = getAttackSquares(board, oppColor);
        const kingSide = color === 'w' ? rights.wK : rights.bK;
        const queenSide = color === 'w' ? rights.wQ : rights.bQ;
        if (
          kingSide &&
          !board[row][5] &&
          !board[row][6] &&
          board[row][7] === color + 'R' &&
          !attacked.has(row + ',4') &&
          !attacked.has(row + ',5') &&
          !attacked.has(row + ',6')
        ) {
          addMove(row, 6, { castle: 'king' });
        }
        if (
          queenSide &&
          !board[row][1] &&
          !board[row][2] &&
          !board[row][3] &&
          board[row][0] === color + 'R' &&
          !attacked.has(row + ',4') &&
          !attacked.has(row + ',3') &&
          !attacked.has(row + ',2')
        ) {
          addMove(row, 2, { castle: 'queen' });
        }
      }
    } else {
      for (const [dr, dc] of DIRS[type]) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!target) {
            addMove(nr, nc, {});
          } else {
            if (pieceColor(target) !== color) addMove(nr, nc, { capture: true });
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    }
    return moves;
  }

  function applyMove(state, move, promotionChoice) {
    const newState = cloneState(state);
    const board = newState.board;
    const { from, to, flags } = move;
    const p = board[from.r][from.c];
    const color = pieceColor(p);

    if (flags.enPassant) {
      board[from.r][to.c] = null;
    }

    board[to.r][to.c] = p;
    board[from.r][from.c] = null;

    if (flags.promotion) {
      board[to.r][to.c] = color + (promotionChoice || 'Q');
    }

    if (flags.castle === 'king') {
      const row = from.r;
      board[row][5] = board[row][7];
      board[row][7] = null;
    } else if (flags.castle === 'queen') {
      const row = from.r;
      board[row][3] = board[row][0];
      board[row][0] = null;
    }

    if (pieceType(p) === 'K') {
      if (color === 'w') {
        newState.castling.wK = false;
        newState.castling.wQ = false;
      } else {
        newState.castling.bK = false;
        newState.castling.bQ = false;
      }
      newState.kingPos[color] = { r: to.r, c: to.c };
    }
    if (pieceType(p) === 'R') {
      if (color === 'w' && from.r === 0 && from.c === 0) newState.castling.wQ = false;
      if (color === 'w' && from.r === 0 && from.c === 7) newState.castling.wK = false;
      if (color === 'b' && from.r === 7 && from.c === 0) newState.castling.bQ = false;
      if (color === 'b' && from.r === 7 && from.c === 7) newState.castling.bK = false;
    }
    if (to.r === 0 && to.c === 0) newState.castling.wQ = false;
    if (to.r === 0 && to.c === 7) newState.castling.wK = false;
    if (to.r === 7 && to.c === 0) newState.castling.bQ = false;
    if (to.r === 7 && to.c === 7) newState.castling.bK = false;

    newState.enPassant = flags.doubleStep ? { r: (from.r + to.r) / 2, c: from.c } : null;
    newState.turn = color === 'w' ? 'b' : 'w';
    return newState;
  }

  function isInCheck(state, color) {
    const kp = state.kingPos[color];
    const oppColor = color === 'w' ? 'b' : 'w';
    return isSquareAttacked(state.board, kp.r, kp.c, oppColor);
  }

  function getLegalMoves(state, r, c) {
    const p = state.board[r][c];
    if (!p) return [];
    const color = pieceColor(p);
    const pseudo = getPseudoMoves(state, r, c);
    return pseudo.filter((move) => {
      const testState = applyMove(state, move, 'Q');
      return !isInCheck(testState, color);
    });
  }

  function getAllLegalMoves(state, color) {
    let all = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (p && pieceColor(p) === color) {
          all = all.concat(getLegalMoves(state, r, c));
        }
      }
    }
    return all;
  }

  function getGameStatus(state) {
    const color = state.turn;
    const legal = getAllLegalMoves(state, color);
    const inCheck = isInCheck(state, color);
    if (legal.length === 0) return inCheck ? 'checkmate' : 'stalemate';
    return inCheck ? 'check' : 'playing';
  }

  window.ChessEngine = {
    createInitialState,
    getLegalMoves,
    getAllLegalMoves,
    applyMove,
    getGameStatus,
    isInCheck,
    pieceColor,
    pieceType,
  };
})();
