(function () {
  const {
    createInitialState,
    getLegalMoves,
    applyMove,
    getGameStatus,
    pieceColor,
  } = window.ChessEngine;

  const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

  const PRESET_THEMES = {
    classic: {
      symbols: {
        wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
        bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
      },
      light: '#f0d9b5',
      dark: '#b58863',
      neon: false,
    },
    neon: {
      symbols: {
        wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
        bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
      },
      light: '#241b3a',
      dark: '#140f24',
      neon: true,
    },
  };

  let state = createInitialState();
  let selected = null;
  let legalTargets = [];
  let pendingPromotion = null;
  let activeThemeName = 'classic';
  let customImages = null;

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const uploadStatusEl = document.getElementById('uploadStatus');
  const modal = document.getElementById('promotionModal');

  function renderBoard() {
    boardEl.innerHTML = '';
    const theme = PRESET_THEMES[activeThemeName] || PRESET_THEMES.classic;
    boardEl.style.setProperty('--light-square', theme.light);
    boardEl.style.setProperty('--dark-square', theme.dark);
    boardEl.classList.toggle('neon-theme', !!theme.neon);

    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const r = rank, c = file;
        const square = document.createElement('div');
        square.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

        if (selected && selected.r === r && selected.c === c) square.classList.add('selected');
        if (legalTargets.some((m) => m.to.r === r && m.to.c === c)) square.classList.add('legal-target');

        const piece = state.board[r][c];
        if (piece) {
          if (customImages && customImages[piece]) {
            const img = document.createElement('img');
            img.src = customImages[piece];
            img.className = 'piece-img';
            square.appendChild(img);
          } else {
            square.textContent = theme.symbols[piece];
            square.classList.add('piece-symbol');
            square.classList.add(pieceColor(piece) === 'w' ? 'piece-white' : 'piece-black');
          }
        }

        square.addEventListener('click', () => onSquareClick(r, c));
        boardEl.appendChild(square);
      }
    }
    updateStatus();
  }

  function onSquareClick(r, c) {
    if (pendingPromotion) return;
    const piece = state.board[r][c];

    if (selected) {
      const move = legalTargets.find((m) => m.to.r === r && m.to.c === c);
      if (move) {
        if (move.flags.promotion) {
          pendingPromotion = move;
          showPromotionModal();
          return;
        }
        state = applyMove(state, move);
        selected = null;
        legalTargets = [];
        renderBoard();
        return;
      }
      if (piece && pieceColor(piece) === state.turn) {
        selected = { r, c };
        legalTargets = getLegalMoves(state, r, c);
        renderBoard();
        return;
      }
      selected = null;
      legalTargets = [];
      renderBoard();
      return;
    }

    if (piece && pieceColor(piece) === state.turn) {
      selected = { r, c };
      legalTargets = getLegalMoves(state, r, c);
      renderBoard();
    }
  }

  function showPromotionModal() {
    modal.classList.remove('hidden');
    modal.querySelectorAll('button').forEach((btn) => {
      btn.onclick = () => {
        state = applyMove(state, pendingPromotion, btn.dataset.piece);
        pendingPromotion = null;
        selected = null;
        legalTargets = [];
        modal.classList.add('hidden');
        renderBoard();
      };
    });
  }

  function updateStatus() {
    const status = getGameStatus(state);
    const turnName = state.turn === 'w' ? 'White' : 'Black';
    if (status === 'checkmate') {
      statusEl.textContent = `Checkmate! ${turnName === 'White' ? 'Black' : 'White'} wins.`;
    } else if (status === 'stalemate') {
      statusEl.textContent = 'Stalemate — draw.';
    } else if (status === 'check') {
      statusEl.textContent = `${turnName} to move — Check!`;
    } else {
      statusEl.textContent = `${turnName} to move`;
    }
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  document.getElementById('presetSelect').addEventListener('change', (e) => {
    activeThemeName = e.target.value;
    customImages = null;
    uploadStatusEl.textContent = '';
    renderBoard();
  });

  document.getElementById('themeUpload').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    const map = {};
    for (const file of files) {
      const name = file.name.replace(/\.[^/.]+$/, '');
      if (PIECE_CODES.includes(name)) {
        map[name] = await fileToDataURL(file);
      }
    }
    const missing = PIECE_CODES.filter((code) => !map[code]);
    if (Object.keys(map).length === 0) {
      uploadStatusEl.textContent = 'No matching files found. Name files exactly: ' + PIECE_CODES.join(', ');
      return;
    }
    customImages = map;
    uploadStatusEl.textContent = missing.length
      ? `Loaded ${Object.keys(map).length}/12. Missing: ${missing.join(', ')} (using symbols for those).`
      : 'Custom theme loaded!';
    renderBoard();
  });

  document.getElementById('restartBtn').addEventListener('click', () => {
    state = createInitialState();
    selected = null;
    legalTargets = [];
    renderBoard();
  });

  renderBoard();
})();
