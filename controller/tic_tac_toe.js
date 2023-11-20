// eslint-disable-next-line no-unused-vars
const { Server } = require("socket.io");
const User = require("../model/databases/user");
const { sendGoodResponse } = require("../utilty");
const socketAuth = require("../middleware/socket_auth");
// eslint-disable-next-line no-unused-vars
const { findAndJoinRoom, waitForPlayer, checkWinner, switchTurn, onUserMove, leaveTicTacToeRoom, initiateMove } = require("../helpers/tic_tac_toe");
// eslint-disable-next-line no-unused-vars
const { Model } = require("sequelize");
// eslint-disable-next-line no-unused-vars
const { MatchEvent, ServerEvents } = require("../model/enums");
// eslint-disable-next-line no-unused-vars
const TicTacToeMatchPlayer = require("../model/databases/tic_tac_toe_match_player");
const { generatePoints } = require("../helpers/common");
// eslint-disable-next-line no-unused-vars
const TicTacToeMoves = require("../model/databases/tic_tac_toe_moves");

/**
 * This function is used to covert the users game point to cash point earned by playing tic tac toe
 * @param {import("express").Request} req 
 * @param {import("express").Response} res 
 */
const ticTacToeSinglePlayer = async(req, res) => {
  /** @type {number} */
  const userId = req.query.user_id;

  console.log(userId);

  /** @type {number} */
  const round = req.query.round;

  /** @type {number} */
  const gamePoint = req.query.game_point;
  console.log(gamePoint);

  await User.increment("cash_point", { by: gamePoint, where: { id: userId } });
  await User.decrement("game_point", { by: gamePoint, where: { id: userId } });
  const user = await generatePoints({ userId })
  sendGoodResponse(res, user);
}

/**
 * 
 * @param {Server} io 
 */
const ticTacToeGameSocket = async (io) => {
  io.use((socket, next) => {
    socketAuth(socket, next);
  });
 
  io.on("connect", async (socket) => {
    /** @type {Model|null} - An instance of the TicTacToeMatch model representing the match the user joined */
    let ticTacMatchPlayer = null;

    /** @type {Model|null} - Sequelize Object of currently joined Room */
    let ticTacToeMatch = null;

    /** @type  {number | null} - UserID of currently logged in user */
    let userId = null

    /** @type {NodeJS.Timeout | null} - Reference to the timeout used anywhere later */
    let timeOut = null;

    /** @type {NodeJS.in | null} - Reference to the timeout used anywhere later */
    let interval = null;

    /** */ 
  
    userId = socket.userId;
    [ticTacToeMatch, ticTacMatchPlayer] = await findAndJoinRoom(userId, socket.id);
    await socket.join(ticTacToeMatch.id);

    waitForPlayer(ticTacToeMatch.id, ticTacMatchPlayer.id, socket, io);

    socket.on("joined", () => {
      console.log("Some one joined the match");
      initiateMove(socket, io, ticTacToeMatch.id, ticTacMatchPlayer.id);
    })
    
    socket.on(MatchEvent.Show, async (move) => {
      onUserMove({ socket, io, move, matchId: ticTacToeMatch.id, playerId: userId, matchPlayerId: ticTacMatchPlayer.id })
    });

    socket.on("disconnect", () => {
      console.log("========== Disconnected ============>");
      console.log(userId);
      leaveTicTacToeRoom(socket, io, ticTacToeMatch.id, userId);
    });
  }); 
}

module.exports = {
  ticTacToeSinglePlayer,
  ticTacToeGameSocket
}
