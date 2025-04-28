import express from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid'; // game IDs
import CheckersGame from '../models/checkersGame.js';

const router = express.Router();


const findValidJumps = (board, row, col, playerColor) => {
 const jumps = [];
 const opponentColor = playerColor === 'black' ? 'red' : 'black';
 const direction = playerColor === 'black' ? 1 : -1; // Black moves down (positive row), red moves up (negative row)

 const checkJump = (r, c, dr, dc) => {
   const jumpRow = r + dr;
   const jumpCol = c + dc;
   const landRow = r + 2 * dr;
   const landCol = c + 2 * dc;

   if (landRow >= 0 && landRow < 8 && landCol >= 0 && landCol < 8 &&
       board[jumpRow]?.[jumpCol]?.startsWith(opponentColor) &&
       board[landRow]?.[landCol] === '') {
     jumps.push({ to: { row: landRow, col: landCol }, captured: { row: jumpRow, col: jumpCol }, from: { row, col } });
   }
 };

 checkJump(row, col, direction, -1);
 checkJump(row, col, direction, 1);
 if (playerColor.endsWith('_king')) {
   checkJump(row, col, -direction, -1);
   checkJump(row, col, -direction, 1);
 }

 return jumps;
};


const findAllJumpSequences = (board, row, col, playerColor, currentSequence = [], allSequences = []) => {
 const validJumps = findValidJumps(board, row, col, playerColor);

 if (validJumps.length === 0) {
   if (currentSequence.length > 0) {
     allSequences.push(currentSequence);
   }
   return allSequences;
 }

 for (const jump of validJumps) {
   const newBoard = board.map(r => [...r]); 
   newBoard[jump.to.row][jump.to.col] = newBoard[row][col];
   newBoard[row][col] = '';
   newBoard[jump.captured.row][jump.captured.col] = '';

   const newSequence = [...currentSequence, jump];
   findAllJumpSequences(newBoard, jump.to.row, jump.to.col, playerColor, newSequence, allSequences);
 }
 return allSequences;
};


router.post('/checkers/:gameId/move', async (req, res) => { 
 const { gameId } = req.params;
 const { from, to, userId } = req.body;

 try {
   const game = await CheckersGame.findOne({ gameId });
   if (!game) {
     return res.status(404).json({ message: 'Game not found' });
   }

   if (game.gameStatus !== 'ongoing') {
     return res.status(400).json({ message: 'Game is not ongoing' });
   }

   if (game.currentTurn?.toString() !== userId) {
     return res.status(403).json({ message: 'It is not your turn' });
   }

   const board = game.boardState;
   const piece = board[from.row]?.[from.col];
   const playerColor = piece?.startsWith('black') ? 'black' : (piece?.startsWith('red') ? 'red' : null);
   const isKing = piece?.endsWith('_king');

   if (!piece || (playerColor === 'black' && game.currentTurn?.toString() !== game.players[0]?.toString()) || (playerColor === 'red' && game.currentTurn?.toString() !== game.players[1]?.toString())) {
     return res.status(400).json({ message: 'Invalid starting position or wrong player' });
   }

   const allPossibleJumps = [];
   for (let r = 0; r < 8; r++) {
     for (let c = 0; c < 8; c++) {
       if (board[r]?.[c]?.startsWith(playerColor)) {
         allPossibleJumps.push(...findAllJumpSequences(board, r, c, playerColor));
       }
     }
   }

   if (allPossibleJumps.length > 0) {
     const moveIsAJump = allPossibleJumps.some(sequence =>
       sequence.some(jump => jump.to.row === to.row && jump.to.col === to.col && sequence[0].from.row === from.row && sequence[0].from.col === from.col)
     );

     if (!moveIsAJump) {
       return res.status(400).json({ message: 'You must take the jump' });
     }

     const jumpSequence = allPossibleJumps.find(sequence =>
       sequence.some(jump => jump.to.row === to.row && jump.to.col === to.col && sequence[0].from.row === from.row && sequence[0].from.col === from.col)
     );

     let newBoard = board.map(r => [...r]);
     let currentFrom = from;
     let capturedPieces = 0;
     for (const jump of jumpSequence) {
       newBoard[jump.to.row][jump.to.col] = newBoard[currentFrom.row][currentFrom.col];
       newBoard[currentFrom.row][currentFrom.col] = '';
       newBoard[jump.captured.row][jump.captured.col] = '';
       currentFrom = jump.to;
       capturedPieces++;
     }

     if ((playerColor === 'black' && currentFrom.row === 7) || (playerColor === 'red' && currentFrom.row === 0)) {
       newBoard[currentFrom.row][currentFrom.col] = playerColor + '_king';
     }

     game.boardState = newBoard;
     game.currentTurn = game.players.find(p => p.toString() !== userId);
     game.lastMove = { from, to, player: userId };
     game.blackPiecesRemaining -= (playerColor === 'red' ? capturedPieces : 0);
     game.redPiecesRemaining -= (playerColor === 'black' ? capturedPieces : 0);

     const availableFollowUpJumps = findValidJumps(newBoard, currentFrom.row, currentFrom.col, playerColor);
     if (availableFollowUpJumps.length > 0) {
       game.currentTurn = userId; 
     }

   } else {
     const rowDiff = Math.abs(to.row - from.row);
     const colDiff = Math.abs(to.col - from.col);

     if (rowDiff !== 1 || colDiff !== 1 || board[to.row]?.[to.col] !== '') {
       return res.status(400).json({ message: 'Invalid move' });
     }

     const rowDirection = to.row - from.row;

     if (!isKing) {
       if (playerColor === 'black' && rowDirection !== 1) {
         return res.status(400).json({ message: 'Black pawns can only move forward' });
       }
       if (playerColor === 'red' && rowDirection !== -1) {
         return res.status(400).json({ message: 'Red pawns can only move forward' });
       }
     }

     const newBoard = board.map(row => [...row]);
     newBoard[to.row][to.col] = newBoard[from.row][from.col];
     newBoard[from.row][from.col] = '';

     if (!isKing && ((playerColor === 'black' && to.row === 7) || (playerColor === 'red' && to.row === 0))) {
       newBoard[to.row][to.col] = playerColor + '_king';
     }

     game.boardState = newBoard;
     game.currentTurn = game.players.find(p => p.toString() !== userId);
     game.lastMove = { from, to, player: userId };
   }

    
    let nextPlayerColor = '';
    if (game.currentTurn?.toString() === game.players[0]?.toString()) {
      nextPlayerColor = 'red';
    } else if (game.currentTurn?.toString() === game.players[1]?.toString()) {
      nextPlayerColor = 'black';
    }

    let nextPlayerHasMoves = false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r]?.[c]?.startsWith(nextPlayerColor)) {
         
          if (findValidJumps(board, r, c, nextPlayerColor).length > 0) {
            nextPlayerHasMoves = true;
            break;
          }

          
          const isKing = board[r]?.[c]?.endsWith('_king');
          const direction = nextPlayerColor === 'black' ? 1 : -1;

          const simpleMoves = [];
          if (isKing) {
            simpleMoves.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
          } else {
            simpleMoves.push([direction, -1], [direction, 1]);
          }

          for (const [dr, dc] of simpleMoves) {
            const newR = r + dr;
            const newC = c + dc;
            if (newR >= 0 && newR < 8 && newC >= 0 && newC < 8 && board[newR][newC] === '') {
              nextPlayerHasMoves = true;
              break;
            }
          }
        }
        if (nextPlayerHasMoves) break;
      }
      if (nextPlayerHasMoves) break;
    }

   if (!nextPlayerHasMoves || game.blackPiecesRemaining === 0 || game.redPiecesRemaining === 0) {
     if (game.blackPiecesRemaining === 0) {
       game.gameStatus = 'player2_wins';
     } else if (game.redPiecesRemaining === 0) {
       game.gameStatus = 'player1_wins';
     } else {
       game.gameStatus = 'draw'; 
     }
   }

   const updatedGame = await game.save();
   res.json(updatedGame);

 } catch (error) { 
   res.status(500).json({ message: error.message });
 } 
});


router.get('/checkers', async (req, res) => { 
 try {
   const games = await CheckersGame.find();
   res.json(games);
 } catch (error) { 
   res.status(500).json({ message: error.message });
 } 
});


router.get('/checkers/:gameId', async (req, res) => { 
 try {
   const game = await CheckersGame.findOne({ gameId: req.params.gameId }).populate('players currentTurn lastMove.player'); 
   if (!game) {
     return res.status(404).json({ message: 'Game not found' });
   }
   res.json(game);
 } catch (error) { 
   res.status(500).json({ message: error.message });
 } 
});


router.patch('/checkers/:gameId/join', async (req, res) => { 
 try {
   const game = await CheckersGame.findOne({ gameId: req.params.gameId });
   if (!game) {
     return res.status(404).json({ message: 'Game not found' });
   }

   if (game.players.length >= 2) {
     return res.status(400).json({ message: 'Game is already full' });
   }

   const userId = req.body.userId; 
   if (!userId) {
     return res.status(400).json({ message: 'User ID to join is required' });
   }

   if (!game.players.includes(userId)) {
     game.players.push(userId);
     if (game.players.length === 2 && !game.currentTurn) {
       game.currentTurn = game.players[0]; 
     }
     const updatedGame = await game.save();
     res.json(updatedGame);
   } else {
     res.status(400).json({ message: 'User is already in the game' });
   }
 } catch (error) { 
   res.status(500).json({ message: error.message });
 } 
});

export { router as gameRoutes };



//  import express from 'express';
//  import mongoose from 'mongoose';
//  import CheckersGame from '../models/checkersGame.js';

//  const router = express.Router();

 
//   const findValidJumps = (board, row, col, playerColor) => {
//   const jumps = [];
//   const opponentColor = playerColor === 'black' ? 'red' : 'black';
//   const direction = playerColor === 'black' ? 1 : -1; 
 
//   const directions = [
//   { rowOffset: direction, colOffset: -1 }, // Top-left/Bottom-left
//   { rowOffset: direction, colOffset: 1 }, // Top-right/Bottom-right
//   ...(playerColor.endsWith('_king') ? [
//   { rowOffset: -direction, colOffset: -1 }, // Bottom-left/Top-left (for kings)
//   { rowOffset: -direction, colOffset: 1 } // Bottom-right/Top-right (for kings)
//   ] : [])
//   ];

//   for (const dir of directions) {
//   const jumpRow = row + dir.rowOffset;
//   const jumpCol = col + dir.colOffset;
//   const landRow = row + 2 * dir.rowOffset;
//   const landCol = col + 2 * dir.rowOffset;

//   if (
//   landRow >= 0 && landRow < 8 &&
//   landCol >= 0 && landCol < 8 &&
//   board[jumpRow][jumpCol]?.startsWith(opponentColor) &&
//   board[landRow][landCol] === ''
//   ) {
//   jumps.push({ to: { row: landRow, col: landCol }, captured: { row: jumpRow, col: jumpCol }, from: { row, col } });
//   }
//   }
//   return jumps;
//  };

 
//  const findAllJumpSequences = (board, row, col, playerColor, currentSequence = [], allSequences = []) => {
//   const validJumps = findValidJumps(board, row, col, playerColor);

//   if (validJumps.length === 0) {
//   if (currentSequence.length > 0) {
//   allSequences.push(currentSequence);
//   }
//   return allSequences;
//   }

//   for (const jump of validJumps) {
//   const newBoard = board.map(r => [...r]); 
//   newBoard[jump.to.row][jump.to.col] = newBoard[row][col];
//   newBoard[row][col] = '';
//   newBoard[jump.captured.row][jump.captured.col] = '';

//   const newSequence = [...currentSequence, jump];
//   findAllJumpSequences(newBoard, jump.to.row, jump.to.col, playerColor, newSequence, allSequences);
//   }
//   return allSequences;
//  };

 
//  router.post('/checkers/:gameId/move', async (req, res) => {
//   const { gameId } = req.params;
//   const { from, to, userId } = req.body; 
//   try {
//   const game = await CheckersGame.findOne({ gameId });
//   if (!game) {
//   return res.status(404).json({ message: 'Game not found' });
//   }

//   if (game.gameStatus !== 'ongoing') {
//   return res.status(400).json({ message: 'Game is not ongoing' });
//   }

//   if (game.currentTurn?.toString() !== userId) {
//   return res.status(403).json({ message: 'It is not your turn' });
//   }

//   const board = game.boardState;
//   const piece = board[from.row][from.col];
//   const playerColor = piece.startsWith('black') ? 'black' : (piece.startsWith('red') ? 'red' : null);

//   if (!piece || (playerColor === 'black' && game.currentTurn?.toString() !== game.players[0]?.toString()) || (playerColor === 'red' && game.currentTurn?.toString() !== game.players[1]?.toString())) {
//   return res.status(400).json({ message: 'Invalid starting position or wrong player' });
//   }

  
//   const allPossibleJumps = [];
//   for (let r = 0; r < 8; r++) {
//   for (let c = 0; c < 8; c++) {
//   if (board[r][c]?.startsWith(playerColor)) {
//   allPossibleJumps.push(...findAllJumpSequences(board, r, c, playerColor));
//   }
//   }
//   }

//   if (allPossibleJumps.length > 0) {
  
//   const moveIsAJump = allPossibleJumps.some(sequence =>
//   sequence.some(jump => jump.to.row === to.row && jump.to.col === to.col && sequence[0].from.row === from.row && sequence[0].from.col === from.col)
//   );

//   if (!moveIsAJump) {
//   return res.status(400).json({ message: 'You must take the jump' });
//   }

  
//   const jumpSequence = allPossibleJumps.find(sequence =>
//   sequence.some(jump => jump.to.row === to.row && jump.to.col === to.col && sequence[0].from.row === from.row && sequence[0].from.col === from.col)
//   );

  
//   let newBoard = board.map(r => [...r]);
//   let currentFrom = from;
//   for (const jump of jumpSequence) {
//   newBoard[jump.to.row][jump.to.col] = newBoard[currentFrom.row][currentFrom.col];
//   newBoard[currentFrom.row][currentFrom.col] = '';
//   newBoard[jump.captured.row][jump.captured.col] = '';
//   currentFrom = jump.to; 
//   }


  
//   if ((playerColor === 'black' && currentFrom.row === 7) || (playerColor === 'red' && currentFrom.row === 0)) {
//   newBoard[currentFrom.row][currentFrom.col] = playerColor + '_king'; // Promote to king
//   }

//   game.boardState = newBoard;
//   game.currentTurn = game.players.find(p => p.toString() !== userId);
//   game.lastMove = { from, to, player: userId };

//   } else {
 
//   const rowDiff = Math.abs(to.row - from.row);
//   const colDiff = Math.abs(to.col - from.col);

//   if (rowDiff !== 1 || colDiff !== 1 || board[to.row][to.col] !== '') {
//   return res.status(400).json({ message: 'Invalid move' });
//   }

//   if (piece === 'black_pawn' && to.row <= from.row) {
//   return res.status(400).json({ message: 'Black pawns can only move forward' });
//   }
//   if (piece === 'red_pawn' && to.row >= from.row) {
//   return res.status(400).json({ message: 'Red pawns can only move forward' });
//   }

//   // board state
//   const newBoard = board.map(row => [...row]); // Create a copy
//   newBoard[to.row][to.col] = newBoard[from.row][from.col];
//   newBoard[from.row][from.col] = '';

//   // Check for kinging
//   if ((playerColor === 'black' && to.row === 7) || (playerColor === 'red' && to.row === 0)) {
//   newBoard[to.row][to.col] = playerColor + '_king'; // Promote to king
//   }


//   game.boardState = newBoard;
//   game.currentTurn = game.players.find(p => p.toString() !== userId); // Switch turns
//   game.lastMove = { from, to, player: userId };
//   }

//   // Check for game over 
//   let nextPlayerColor = game.currentTurn === game.players[0] ? 'black' : 'red';
//   let nextPlayerHasMoves = false;
//   for (let r = 0; r < 8; r++) {
//   for (let c = 0; c < 8; c++) {
//   if (game.boardState[r][c]?.startsWith(nextPlayerColor)) {
//   if (findValidJumps(game.boardState, r, c, nextPlayerColor).length > 0 ||
//   (nextPlayerColor.endsWith('_king') ? true : //kings can move backwards
//   (nextPlayerColor === 'black' ? (r < 7 && ((c > 0 && game.boardState[r+1][c-1] === '') || (c < 7 && game.boardState[r+1][c+1] === ''))) : (r > 0 && ((c > 0 && game.boardState[r-1][c-1] === '') || (c < 7 && game.boardState[r-1][c+1] === '')))))
//   )
//   {
//   nextPlayerHasMoves = true;
//   break;
//   }
//   }
//   }
//   if (nextPlayerHasMoves) break;
//   }

//   if (!nextPlayerHasMoves) {
//   game.gameStatus = playerColor === 'black' ? 'player1_wins' : 'player2_wins';
//   }


//   const updatedGame = await game.save();
//   res.json(updatedGame);

//   } catch (error) {
//   res.status(500).json({ message: error.message });
//   }
//  });

//  export { router as gameRoutes };





































// import express from 'express';
// import mongoose from 'mongoose';
// import CheckersGame from '../models/checkersGame.js';

// const router = express.Router();


// router.post('/checkers/:gameId/move', async (req, res) => {
//     const { gameId } = req.params;
//     const { from, to, userId } = req.body; 

//     try {
//         const game = await CheckersGame.findOne({ gameId });
//         if (!game) {
//             return res.status(404).json({ message: 'Game not found' });
//         }

//         if (game.gameStatus !== 'ongoing') {
//             return res.status(400).json({ message: 'Game is not ongoing' });
//         }

//         if (game.currentTurn?.toString() !== userId) {
//             return res.status(403).json({ message: 'It is not your turn' });
//         }

//         const board = game.boardState;
//         const piece = board[from.row][from.col];
//         const playerColor = piece.startsWith('black') ? 'black' : (piece.startsWith('red') ? 'red' : null);

//         if (!piece || (playerColor === 'black' && game.currentTurn?.toString() !== game.players[0]?.toString()) || (playerColor === 'red' && game.currentTurn?.toString() !== game.players[1]?.toString())) {
//             return res.status(400).json({ message: 'Invalid starting position or wrong player' });
//         }

        
//         const rowDiff = Math.abs(to.row - from.row);
//         const colDiff = Math.abs(to.col - from.col);

//         if (rowDiff !== 1 || colDiff !== 1 || board[to.row][to.col] !== '') {
//             return res.status(400).json({ message: 'Invalid move' });
//         }

        
//         if (piece === 'black_pawn' && to.row <= from.row) {
//             return res.status(400).json({ message: 'Black pawns can only move forward' });
//         }
//         if (piece === 'red_pawn' && to.row >= from.row) {
//             return res.status(400).json({ message: 'Red pawns can only move forward' });
//         }

//         //  board state
//         const newBoard = board.map(row => [...row]); 
//         newBoard[to.row][to.col] = newBoard[from.row][from.col];
//         newBoard[from.row][from.col] = '';

//         // game state
//         game.boardState = newBoard;
//         game.currentTurn = game.players.find(p => p.toString() !== userId); // Switch turns
//         game.lastMove = { from, to, player: userId };

//         const updatedGame = await game.save();
//         res.json(updatedGame);

//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });

// export { router as gameRoutes };