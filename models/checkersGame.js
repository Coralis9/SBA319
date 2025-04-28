import mongoose from 'mongoose';

const CheckersGameSchema = new mongoose.Schema({
   gameStatus: {
       type: String,
       enum: ['ongoing', 'player1_wins', 'player2_wins', 'draw'],
       default: 'ongoing'
   },
   boardState: {
       type: [[String]],
       default: [
           ['', 'black_pawn', '', 'black_pawn', '', 'black_pawn', '', 'black_pawn'],
           ['black_pawn', '', 'black_pawn', '', 'black_pawn', '', 'black_pawn', ''],
           ['', 'black_pawn', '', 'black_pawn', '', 'black_pawn', '', 'black_pawn'],
           ['', '', '', '', '', '', '', ''],
           ['', '', '', '', '', '', '', ''],
           ['red_pawn', '', 'red_pawn', '', 'red_pawn', '', 'red_pawn', ''],
           ['', 'red_pawn', '', 'red_pawn', '', 'red_pawn', '', 'red_pawn'],
           ['red_pawn', '', 'red_pawn', '', 'red_pawn', '', 'red_pawn', '']
       ]
   },
   players: [{
       type: mongoose.Schema.Types.ObjectId,
       ref: 'User'
   }],
   currentTurn: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'User'
   },
   blackPiecesRemaining: {
       type: Number,
       default: 12
   },
   redPiecesRemaining: {
       type: Number,
       default: 12
   },
   lastMove: {
       type: {
           from: { row: Number, col: Number },
           to: { row: Number, col: Number },
           player: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
       },
       default: null
   },
   gameId: {
       type: String,
       unique: true,
       required: true
   },
   creationTime: {
       type: Date,
       default: Date.now
   },
   possibleMoves: {
       type: Object,
       default: {}
   }
});

const CheckersGame = mongoose.model('CheckersGame', CheckersGameSchema);

export default CheckersGame;