const game = new Chess();

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const sideSelect = document.getElementById('sideSelect');
const difficultySelect = document.getElementById('difficultySelect');
const promoModal = document.getElementById('promoModal');
const promoChoices = document.getElementById('promoChoices');

let selectedSquare = null;
let lastMove = null;
let playerColor = 'w';
let pendingPromotion = null;

const pieceSymbols = {
  p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
  // Use filled glyphs for both sides; CSS controls the piece colour.
  P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚'
};

const pieceValues = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

function getKingSquares() {
  const board = game.board();
  const kings = { w: null, b: null };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];

      if (piece && piece.type === 'k') {
        kings[piece.color] = String.fromCharCode(97 + c) + (8 - r);
      }
    }
  }

  return kings;
}

function renderBoard() {
  boardEl.innerHTML = '';

  const board = game.board();
  const legalMoves = selectedSquare
    ? game.moves({ square: selectedSquare, verbose: true }).map(m => m.to)
    : [];

  const kings = getKingSquares();
  const turn = game.turn();
  const isCheckmate = game.in_checkmate();
  const isDraw = game.in_draw();
  const isCheck = game.in_check();

  // Reverse both axes when playing as Black so the board is rotated.
  const rows = playerColor === 'w'
    ? [0, 1, 2, 3, 4, 5, 6, 7]
    : [7, 6, 5, 4, 3, 2, 1, 0];

  const cols = playerColor === 'w'
    ? [0, 1, 2, 3, 4, 5, 6, 7]
    : [7, 6, 5, 4, 3, 2, 1, 0];

  for (const r of rows) {
    for (const c of cols) {
      const squareName = String.fromCharCode(97 + c) + (8 - r);
      const sqEl = document.createElement('div');

      sqEl.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

      if (lastMove && (lastMove.from === squareName || lastMove.to === squareName)) {
        sqEl.classList.add('last-move');
      }

      if (selectedSquare === squareName) sqEl.classList.add('selected');
      if (legalMoves.includes(squareName)) sqEl.classList.add('highlight');

      if (isCheckmate) {
        const loserSquare = kings[turn];
        const winnerSquare = kings[turn === 'w' ? 'b' : 'w'];

        if (squareName === loserSquare) sqEl.classList.add('king-loser');
        if (squareName === winnerSquare) sqEl.classList.add('king-winner');
      } else if (isDraw) {
        if (squareName === kings.w || squareName === kings.b) {
          sqEl.classList.add('king-draw');
        }
      } else if (isCheck && squareName === kings[turn]) {
        sqEl.classList.add('in-check');
      }

      const piece = board[r][c];

      if (piece) {
        const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
        sqEl.classList.add(piece.color === 'w' ? 'white-piece' : 'black-piece');
        sqEl.textContent = pieceSymbols[key];
      }

      sqEl.onclick = () => onSquareClick(squareName);
      boardEl.appendChild(sqEl);
    }
  }

  updateStatus();
}

function startThinking() {
  statusEl.textContent = 'Bot is thinking';
  statusEl.classList.add('thinking-status');
}

function stopThinking() {
  statusEl.classList.remove('thinking-status');
}

function showPromotionDialog(from, to) {
  pendingPromotion = { from, to };
  promoChoices.innerHTML = '';

  const options = ['q', 'r', 'b', 'n'];

  options.forEach(type => {
    const btn = document.createElement('button');
    btn.className = 'promo-btn';

    const key = playerColor === 'w' ? type.toUpperCase() : type;
    btn.textContent = pieceSymbols[key];
    btn.onclick = () => completePromotion(type);

    promoChoices.appendChild(btn);
  });

  promoModal.style.display = 'flex';
}

function completePromotion(pieceType) {
  promoModal.style.display = 'none';
  if (!pendingPromotion) return;

  const move = game.move({
    from: pendingPromotion.from,
    to: pendingPromotion.to,
    promotion: pieceType
  });

  pendingPromotion = null;
  selectedSquare = null;

  if (move) {
    lastMove = { from: move.from, to: move.to };
    renderBoard();

    if (!game.game_over()) {
      startThinking();
      setTimeout(makeAIMove, 0);
    }
  }
}

function onSquareClick(square) {
  if (game.game_over() || game.turn() !== playerColor || pendingPromotion) return;

  if (selectedSquare) {
    const matchingMoves = game.moves({ square: selectedSquare, verbose: true })
      .filter(m => m.to === square);

    if (matchingMoves.length > 0 && matchingMoves[0].flags.includes('p')) {
      showPromotionDialog(selectedSquare, square);
      return;
    }

    const move = game.move({ from: selectedSquare, to: square });
    selectedSquare = null;

    if (move) {
      lastMove = { from: move.from, to: move.to };
      renderBoard();

      if (!game.game_over()) {
        startThinking();
        setTimeout(makeAIMove, 0);
      }
    } else {
      const piece = game.get(square);
      if (piece && piece.color === playerColor) selectedSquare = square;
      renderBoard();
    }
  } else {
    const piece = game.get(square);

    if (piece && piece.color === playerColor) {
      selectedSquare = square;
      renderBoard();
    }
  }
}

function evaluateBoard(aiColor) {
  let total = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];

      if (piece) {
        const val = pieceValues[piece.type];
        total += piece.color === aiColor ? val : -val;
      }
    }
  }

  return total;
}

function minimax(depth, alpha, beta, isMaximizing, aiColor) {
  if (depth === 0 || game.game_over()) {
    if (game.in_checkmate()) return isMaximizing ? -9999 : 9999;
    return evaluateBoard(aiColor);
  }

  const moves = game.moves();

  if (isMaximizing) {
    let maxEval = -Infinity;

    for (const move of moves) {
      game.move(move);
      const ev = minimax(depth - 1, alpha, beta, false, aiColor);
      game.undo();

      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);

      if (beta <= alpha) break;
    }

    return maxEval;
  } else {
    let minEval = Infinity;

    for (const move of moves) {
      game.move(move);
      const ev = minimax(depth - 1, alpha, beta, true, aiColor);
      game.undo();

      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);

      if (beta <= alpha) break;
    }

    return minEval;
  }
}

function makeAIMove() {
  stopThinking();
  const moves = game.moves();
  if (moves.length === 0) return;

  const difficulty = difficultySelect.value;
  const aiColor = playerColor === 'w' ? 'b' : 'w';
  let chosenMove = null;

  if (difficulty === 'easy') {
    chosenMove = moves[Math.floor(Math.random() * moves.length)];
  } else {
    const searchDepth = difficulty === 'medium' ? 1 : 2;
    let bestValue = -Infinity;

    moves.sort(() => Math.random() - 0.5);

    for (const move of moves) {
      game.move(move);
      const boardValue = minimax(searchDepth, -Infinity, Infinity, false, aiColor);
      game.undo();

      if (boardValue > bestValue) {
        bestValue = boardValue;
        chosenMove = move;
      }
    }
  }

  if (!chosenMove) return;

  const moveObj = game.move(chosenMove);
  if (moveObj) lastMove = { from: moveObj.from, to: moveObj.to };

  renderBoard();
}

function updateStatus() {
  const isPlayerTurn = game.turn() === playerColor;

  if (game.in_checkmate()) {
    statusEl.textContent = isPlayerTurn
      ? 'Checkmate! AI wins.'
      : 'Checkmate! You win!';
  } else if (game.in_draw()) {
    statusEl.textContent = 'Game Over: Draw!';
  } else {
    const turnLabel = isPlayerTurn ? 'Your turn' : 'AI turn';
    statusEl.textContent = turnLabel + (game.in_check() ? ' - CHECK!' : '');
  }
}

function resetGame() {
  game.reset();
  promoModal.style.display = 'none';
  pendingPromotion = null;
  playerColor = sideSelect.value;
  selectedSquare = null;
  lastMove = null;

  renderBoard();

  if (playerColor === 'b') {
    startThinking();
    setTimeout(makeAIMove, 0);
  }
}

document.querySelectorAll('.difficulty-option').forEach(button => {
  button.addEventListener('click', () => {
    difficultySelect.value = button.dataset.level;
    document.querySelectorAll('.difficulty-option').forEach(option => option.classList.remove('active'));
    button.classList.add('active');
  });
});

renderBoard();
window.testGame = game;
window.testRender = renderBoard;