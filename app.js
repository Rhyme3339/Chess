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

  // Game/session state
  let state = createInitialState();
  let selected = null;
  let legalTargets = [];
  let pendingPromotion = null;
  let activeThemeName = 'classic';
  let customImages = null;

  // Mode state
  let gameMode = 'friend'; // 'friend' | 'ai'
  let aiDifficulty = 'medium';
  let humanColor = 'w'; // which color the human plays when gameMode === 'ai'

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const uploadStatusEl = document.getElementById('uploadStatus');
  const modal = document.getElementById('promotionModal');

  // ---------- Screen management ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  }

  function startGame() {
    state = createInitialState();
    selected = null;
    legalTargets = [];
    showScreen('screen-game');
    renderBoard();
    maybeTriggerAI();
  }

  // ---------- Rendering ----------
  function renderBoard() {
    boardEl.innerHTML = '';
    const theme = PRESET_THEMES[activeThemeName] || PRESET_THEMES.classic;
    boardEl.style.setProperty('--light-square', theme.light);
    boardEl.style.setProperty('--dark-square', theme.dark);
    boardEl.classList.toggle('neon-theme', !!theme.neon);

    const flip = gameMode === 'ai' && humanColor === 'b';
    const rankOrder = flip ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const fileOrder = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

    for (const r of rankOrder) {
      for (const c of fileOrder) {
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

  // ---------- Interaction ----------
  function onSquareClick(r, c) {
    if (pendingPromotion) return;
    if (gameMode === 'ai') {
      const aiColor = humanColor === 'w' ? 'b' : 'w';
      if (state.turn === aiColor) return; // not your turn
    }

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
        maybeTriggerAI();
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
        maybeTriggerAI();
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

  // ---------- AI ----------
  function maybeTriggerAI() {
    if (gameMode !== 'ai') return;
    const aiColor = humanColor === 'w' ? 'b' : 'w';
    if (state.turn !== aiColor) return;

    const status = getGameStatus(state);
    if (status === 'checkmate' || status === 'stalemate') return;

    statusEl.textContent = '🤖 AI is thinking...';
    setTimeout(() => {
      const move = window.ChessAI.getBestMove(state, aiDifficulty);
      if (move) state = applyMove(state, move, 'Q');
      renderBoard();
    }, 60);
  }

  // ---------- Theme / options ----------
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

  // ---------- Menu wiring ----------
  document.getElementById('vsFriendBtn').addEventListener('click', () => {
    gameMode = 'friend';
    startGame();
  });

  document.getElementById('vsAiBtn').addEventListener('click', () => {
    showScreen('screen-vsai-setup');
  });

  document.getElementById('optionsBtn').addEventListener('click', () => {
    showScreen('screen-options');
  });

  document.getElementById('exitBtn').addEventListener('click', () => {
    window.close();
    setTimeout(() => {
      alert("This tab can't be auto-closed by the page — feel free to close it yourself.");
    }, 200);
  });

  document.getElementById('backFromAiBtn').addEventListener('click', () => showScreen('screen-menu'));
  document.getElementById('backFromOptionsBtn').addEventListener('click', () => showScreen('screen-menu'));
  document.getElementById('menuBtn').addEventListener('click', () => showScreen('screen-menu'));

  document.getElementById('startAiBtn').addEventListener('click', () => {
    aiDifficulty = document.getElementById('difficultySelect').value;
    humanColor = document.getElementById('sideSelect').value;
    gameMode = 'ai';
    startGame();
  });

  document.getElementById('restartBtn').addEventListener('click', () => {
    startGame();
  });

  showScreen('screen-menu');
})();
