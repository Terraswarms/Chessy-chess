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
let searchToken = 0;

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
  aiThinking = true;

  const text = 'Bot is thinking';

  statusEl.innerHTML = [...text]
    .map((letter, index) => {
      const safeLetter = letter === ' ' ? '&nbsp;' : letter;
      return `<span style="--letter-index: ${index}">${safeLetter}</span>`;
    })
    .join('');

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
  if (game.in_checkmate()) return game.turn() === aiColor ? -1000000 : 1000000;
  if (game.in_draw()) return 0;

  let total = 0;
  const board = game.board();
  const pawnFiles = { w: Array(8).fill(0), b: Array(8).fill(0) };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const sign = piece.color === aiColor ? 1 : -1;
      const centerDistance = Math.abs(3.5 - r) + Math.abs(3.5 - c);
      let value = pieceValues[piece.type];

      if (piece.type === 'p') {
        pawnFiles[piece.color][c]++;
        const advancement = piece.color === 'w' ? 6 - r : r - 1;
        value += advancement * 4;
        if (c === 3 || c === 4) value += 8;
      } else if (piece.type === 'n' || piece.type === 'b') {
        value += Math.max(0, 4 - centerDistance) * 8;
      } else if (piece.type === 'r') {
        const hasPawnOnFile = board.some(row => row[c]?.type === 'p' && row[c]?.color === piece.color);
        if (!hasPawnOnFile) value += 18;
      }

      total += sign * value;
    }
  }

  // Prefer active positions and discourage moving rooks/queens too early.
  const mobility = game.moves().length;
  total += (game.turn() === aiColor ? mobility : -mobility) * 2;
  if (game.history().length < 12) {
    board.flat().forEach(piece => {
      if (!piece || piece.color !== aiColor) return;
      if (piece.type === 'q') total -= 10;
      if (piece.type === 'r' && piece.square !== undefined) total -= 4;
    });
  }

  return total;
}

function orderMoves(moves) {
  const scoredMoves = moves.map(move => {
    let value = 0;

    if (move.captured) {
      value += 10 * pieceValues[move.captured];
      value -= pieceValues[move.piece];
    }

    if (move.promotion) {
      value += 800;
    }

    if (move.flags.includes('k') || move.flags.includes('q')) {
      value += 35;
    }

    // Check whether this move gives check.
    game.move(move);
    if (game.in_check()) {
      value += 500;
    }
    game.undo();

    return { move, value };
  });

  scoredMoves.sort((a, b) => b.value - a.value);

  return scoredMoves.map(item => item.move);
}

function quiescenceSearch(depth, alpha, beta, isMaximizing, aiColor) {
  if (game.in_checkmate()) {
    return game.turn() === aiColor
      ? -1000000 - depth
      : 1000000 + depth;
  }

  if (game.in_draw()) return 0;

  const standPat = evaluateBoard(aiColor);

  if (depth === 0) return standPat;

  const inCheck = game.in_check();
  let moves = game.moves({ verbose: true });

  // Only continue forcing moves unless the king is in check.
  if (!inCheck) {
    moves = moves.filter(move => {
      if (move.captured || move.promotion) return true;

      game.move(move);
      const givesCheck = game.in_check();
      game.undo();

      return givesCheck;
    });
  }

  moves = orderMoves(moves);

  if (isMaximizing) {
    let best = standPat;
    alpha = Math.max(alpha, best);

    for (const move of moves) {
      game.move(move);

      const value = quiescenceSearch(
        depth - 1,
        alpha,
        beta,
        false,
        aiColor
      );

      game.undo();

      best = Math.max(best, value);
      alpha = Math.max(alpha, value);

      if (beta <= alpha) break;
    }

    return best;
  }

  let best = standPat;
  beta = Math.min(beta, best);

  for (const move of moves) {
    game.move(move);

    const value = quiescenceSearch(
      depth - 1,
      alpha,
      beta,
      true,
      aiColor
    );

    game.undo();

    best = Math.min(best, value);
    beta = Math.min(beta, value);

    if (beta <= alpha) break;
  }

  return best;
}

function minimax(depth, alpha, beta, isMaximizing, aiColor) {
  if (game.in_checkmate()) return game.turn() === aiColor ? -1000000 - depth : 1000000 + depth;
  if (game.game_over()) return evaluateBoard(aiColor);

  if (depth === 0) {
    return quiescenceSearch(
      1,
      alpha,
      beta,
      isMaximizing,
      aiColor
    );
  }

  const moves = orderMoves(game.moves({ verbose: true }));

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
const openingBook = {
  //  AI IS WHITE 
  '': ['e4', 'd4'], // Removed Nf3 to keep White's plan direct
  
  // 1. e4 lines (Italian Game focus)
  'e4 e5': ['Nf3'],
  'e4 e5 Nf3 Nc6': ['Bc4'],
  'e4 c5': ['Nf3'],          // Anti-Sicilian: simple development
  'e4 c5 Nf3 d6': ['d4'],
  'e4 c5 Nf3 Nc6': ['d4'],
  'e4 c6': ['d4'],           // vs Caro-Kann
  'e4 e6': ['d4'],           // vs French
  'e4 d5': ['exd5'],         // vs Scandinavian (just take the free center pawn)
  'e4 d5 exd5 Qxd5':['Nc3'],

  // 1. d4 lines (Queen's Gambit / London focus)
  'd4 d5': ['c4', 'Bf4'],
  'd4 Nf6': ['Nf3', 'Bf4'],

  // === AI IS BLACK ===
  // vs 1. e4 (Stick to symmetrical e5 or solid Caro-Kann c6)
  'e4': ['e5', 'c6'],
  'e4 e5 Nf3': ['Nc6'],
  'e4 e5 Nf3 Nc6 Bc4': ['Bc5', 'Nf6'],
  'e4 e5 Nf3 Nc6 Bb5': ['Nf6','a6'],
  'e4 c6': ['d4'],
  //carokann
  'e4 c6 d4': ['d5'],
  'e4 c6 d4 d5': ['exd5', 'Nc3'],
  'e4 c6 d4 d5 exd5': ['cxd5'],
  'e4 c6 d4 d5 e5': ['Bf5'],
  'e4 c6 d4 d5 Nc3': ['dxe4'],
  'e4 c6 d4 d5 exd5 cxd5 Nc3': ['Bf5', 'Nf6'],
  'e4 c6 e5': ['Bf5'],

  // vs 1. d4 (Stick to symmetrical d5 or solid Nf6)
  'd4': ['d5', 'Nf6'],
  'd4 d5 c4': ['e6', 'c6'],  // QGD or Slav (super solid)
  'd4 d5 Bf4': ['Nf6', 'e6'],
  'd4 Nf6 c4': ['e6'],       // Avoids sharp King's Indian (g6)

  // vs 1. Nf3 (Mirror the center)
  'Nf3': ['d5', 'Nf6'],
  'Nf3 d5 c4': ['e6', 'c6'],
  'Nf3 d5 g3': ['Nf6']
};


function getOpeningBookMove() {
  if (game.history().length > 14) return null;

  const options = openingBook[game.history().join(' ')];
  if (!options) return null;

  const legalMoves = game.moves();
  const available = options.filter(move => legalMoves.includes(move));
  return available.length ? available[Math.floor(Math.random() * available.length)] : null;
}

function finishAIMove(chosenMove) {
  stopThinking();

  if (!chosenMove || game.game_over()) {
    renderBoard();
    return;
  }

  const moveObj = game.move(chosenMove);

  if (moveObj) {
    lastMove = {
      from: moveObj.from,
      to: moveObj.to
    };
  }

  renderBoard();
}

function searchBestMoveAsync(
  moves,
  index,
  bestValue,
  bestMove,
  searchDepth,
  aiColor,
  token
) {
  if (token !== searchToken) return;

  if (index >= moves.length) {
    finishAIMove(bestMove);
    return;
  }

  const move = moves[index];

  game.move(move);

  const earlyRookPenalty =
    move.piece === 'r' && game.history().length < 8 ? 35 : 0;


  let castlingPenalty = 0;

  if (move.flags.includes('k') || move.flags.includes('q')) {
    const color = aiColor;
    const pawnRank = color === 'w' ? '2' : '7';

    const exposedFiles = move.flags.includes('k')
      ? ['f', 'g']
      : ['b', 'c', 'd'];

    for (const file of exposedFiles) {
      const piece = game.get(file + pawnRank);

      if (!piece || piece.type !== 'p' || piece.color !== color) {
        castlingPenalty += 25;
      }
    }
  }

  const boardValue =
    minimax(searchDepth, -Infinity, Infinity, false, aiColor) -
    castlingPenalty -
    earlyRookPenalty;

  game.undo();  

  const nextBestValue =
    boardValue > bestValue ? boardValue : bestValue;

  const nextBestMove =
    boardValue > bestValue ? move : bestMove;

  setTimeout(() => {
    searchBestMoveAsync(
      moves,
      index + 1,
      nextBestValue,
      nextBestMove,
      searchDepth,
      aiColor,
      token
    );
  }, 0);
}

function makeAIMove() {
  const moves = game.moves();
  if (moves.length === 0) return;

  const difficulty = difficultySelect.value;
  const aiColor = playerColor === 'w' ? 'b' : 'w';
  let chosenMove = null;

  if (difficulty === 'easy') {
    chosenMove = moves[Math.floor(Math.random() * moves.length)];
  } else {
    if (difficulty === 'hard') chosenMove = getOpeningBookMove();
    if (chosenMove) {
      // Use the book move while the current position is familiar.
    } else {
      const searchDepth = difficulty === 'medium' ? 1 : 2;
      const orderedMoves = orderMoves(
        game.moves({ verbose: true })
      );

      if (difficulty === 'medium') {
        orderedMoves.sort(() => Math.random() - 0.5);
      }

      const token = ++searchToken;

      searchBestMoveAsync(
        orderedMoves,
        0,
        -Infinity,
        null,
        searchDepth,
        aiColor,
        token
      );

      return;
    }
  }

  if (!chosenMove) {
    stopThinking();
    return;
  }

  finishAIMove(chosenMove);
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