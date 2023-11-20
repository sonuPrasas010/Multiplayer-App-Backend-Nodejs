const { Socket, Server } = require("socket.io");
// eslint-disable-next-line no-unused-vars
const { Model, Sequelize, Op } = require("sequelize");

// const {
//   LowCardMatchPlayer,
//   LowCardMatch,
//   LowCardMessages
// } = require("../model/config/relations");

const { MessageType, GameStatus, MatchEvent } = require("../model/enums");
const User = require("../model/databases/user");
const sequelize = require("../model/config/config");
const TicTacToeMatch = require("../model/databases/tic_tac_toe_match");
const TicTacToeMatchPlayer = require("../model/databases/tic_tac_toe_match_player");
const TicTacToeMoves = require("../model/databases/tic_tac_toe_moves");
const { delay } = require("../utilty");

// this is private function
/**
 * This asynchronous function finds a room for a user's Tic Tac Toe match and joins them to that room.
 *
 * @param {Number} userId - The unique identifier of the user.
 * @param {String} socketId - The unique identifier of the user's socket connection.
 *
 * @returns {Promise<Array>} - A promise that resolves to an array containing two elements:
 *                             1. An instance of the TicTacToeMatch model representing the match the user joined.
 *                             2. An instance of the TicTacToeMatchPlayer model representing the user's participation in the match.
 *
 * @throws {Error} If there is a problem with the database operations.
 *
 * @example
 * const [match, player] = await findAndJoinRoom(userId, socketId);
 *
 * @description
 * - The function first attempts to find a Tic Tac Toe match that only has one player. It does this by querying the TicTacToeMatch model and including a count of associated TicTacToeMatchPlayer models. It then checks if such a match exists.
 *
 * - If such a match exists, it calls the `joinTicTacToeRoom` function with the match's id, the user's id, and the socket id. This function is responsible for joining the user to the room associated with the match. The `joinTicTacToeRoom` function is expected to return an instance of the TicTacToeMatchPlayer model representing the user's participation in the match. Both the match and player are then returned as an array.
 *
 * - If no such match exists, it creates a new Tic Tac Toe match by calling `TicTacToeMatch.create()`. It then calls `joinTicTacToeRoom` in the same way as above and returns both the new match and player as an array.
 */
async function findAndJoinRoom(userId, socketId) {
  let ticTacToeMatch = await TicTacToeMatch.findOne({
    where: { game_status: GameStatus.Ideal },
    attributes: {
      include: [[
        sequelize.literal(
          "(Select COUNT(*) FROM tic_tac_toe_match_players WHERE tic_tac_toe_match_players.match_id = tic_tac_toe_match.id)"
        ),
        "playerCount"
      ]]
    },
    having: sequelize.literal("playerCount < 2")
  });

  if (!ticTacToeMatch) {
    ticTacToeMatch = await TicTacToeMatch.findOne({
      where: {
        game_status: GameStatus.Ideal
      }
    });
  }

  if (ticTacToeMatch) {
    const ticTacToeMatchPlayer = await joinTicTacToeRoom(ticTacToeMatch.id, userId, socketId);
    return [ticTacToeMatch, ticTacToeMatchPlayer];
  }

  ticTacToeMatch = await TicTacToeMatch.create();
  const ticTacToeMatchPlayer = await joinTicTacToeRoom(ticTacToeMatch.id, userId, socketId);
  return [ticTacToeMatch, ticTacToeMatchPlayer];
}

/**
 * 
 * @param {number} matchId 
 * @param {number} userId 
 * @param {string} socketId 
 * @returns 
 */
async function joinTicTacToeRoom (matchId, userId, socketId) {
  await User.decrement("game_point", { by: 10, where: { id: userId } });
  await TicTacToeMatch.increment("prize", { by: 10, where: { id: matchId } });
  const ticTacToeMatchPlayer = await TicTacToeMatchPlayer.create({ match_id: matchId, user_id: userId, socket_id: socketId, bet: 10 });
  return ticTacToeMatchPlayer;
}

/**
 * 
 * @param {number} matchId 
 * @param {number} matchPlayerId 
 * @param {Socket} socket 
 * @param {Server} io
 */
async function waitForPlayer(matchId, matchPlayerId, socket, io) {
  /** The number of joined users who are in this match */
  const joined = await TicTacToeMatchPlayer.count({ where: { match_id: matchId } });
  if (joined === 2) {
    onSecondPersonJoin(socket, io, matchId, matchPlayerId);
  } 
}

/**
 * 
 * @param {Socket} socket 
 * @param {Server} io 
 * @param {number} matchId 
 * @param {number} matchPlayerId 
 */
async function onSecondPersonJoin(socket, io, matchId, matchPlayerId) {
  console.log("Second person joined");
  const ticTacToeMatchPlayers = await TicTacToeMatchPlayer.findOne({ where: { match_id: matchId }, include: User, order: [["id", "ASC"]] });
  console.log(ticTacToeMatchPlayers.toJSON());
  const ticTacToeMatch = await TicTacToeMatch.findByPk(matchId);

  await TicTacToeMatch.update({ round: 1, game_status: GameStatus.Starting, turn: ticTacToeMatchPlayers.user_id }, { where: { id: matchId } });
  io.emit(MatchEvent.GameStatus, GameStatus.Starting);

  const gameInfo = await generateGameInfo(matchId);
  io.emit(MatchEvent.Joined, { players: gameInfo.players, prize: ticTacToeMatch.prize, turn: ticTacToeMatchPlayers.user_id });

  // await TicTacToeMatch.update({ game_status: GameStatus.Playing }, { where: { id: matchId } });
  // initiateMove function is commented because it both user's need to acknowledge the MatchEvent.joined 
  // but acknowledge is not implemented yet. So we are listening from user to initiate the move
  // initiateMove(socket, io, matchId, matchPlayerId);
}

/**
 * The purpose of this function is to initiate the move of the player i.e to provide the ability to the user to make their whose turn is it.
 * 
 * **Step 1** Create an unique identifier as current timestamp usin changeIdentifier()
 * 
 * **Step 2** Find out whose turn is it and emit the necessary events.
 * 
 * **Step 3** Set  function that runs after every 1.5 seconds and checks if the unique identifier had changed or not. If the unique identifier has been changed 
 * i.e. if some other has already make move than clear the interval and timeout. This is because to prevent timeout function execution that executes if player does not make any moves.
 * 
 * **Step 4** Set timeout after 15 seconds. The purpose of this function is to make a move for a user who do not make their move after 15 seconds.
 * This function needs to be cleared if user make their move before 15 seconds. S
 * @param {Socket} socket 
 * @param {Server} io 
 * @param {number} matchId 
 */
async function initiateMove(socket, io, matchId) {
  /** This is the identifier of the move. First it creates te unique date and unique identifier and then it updates it to . */
  
  const identifier = await changeIdentifier(matchId)
  console.log("Time" + identifier);
  const match = await TicTacToeMatch.findByPk(matchId);

  /** Id of user whose turn is it */
  const turn = match.turn;
  match.game_status = GameStatus.Playing;
  await match.save();
  /**
   * Emit Object in the following Format
   * {
   *  time: new Date(),
   *  turn: id,
   *  game_status: gameStatus
   * }
   */
  io.to(matchId).emit(MatchEvent.StartTime, generateStartTime(new Date(), turn, GameStatus.Playing));
  console.log("broadcasting StartTime");
  
  const interval = setInterval(async () => {
    console.log("___=>");
    console.log("Time" + identifier)
    const sqlDate = identifier.toISOString().slice(0, 19).replace("T", " "); // Format for MySQL
    console.log(sqlDate);
    
    if (!await checkIdentifier(matchId, identifier)) {
      clearIntervalAndTimeout(interval, timeOut);
    }
  }, 1500);
  const timeOut = setTimeout(async() => {
    console.log("hello")
    if (!await checkIdentifier(matchId, identifier)) return;
    clearIntervalAndTimeout(interval, timeOut); 
    makeMoveForUser(socket, io, matchId);
    // make a move for user
  }, 15000)
}

/**
 * 
 * @param {number} matchId id of TicTacToe match whose turn needs to be switched
 * @returns {Promise<number>} id of user whose turn is it
 */
async function switchTurn(matchId, userId) {
  const ticTacToeMatch = await TicTacToeMatch.findByPk(matchId);
  const ticTacToeMatchPlayer = await TicTacToeMatchPlayer.findOne({ where: { match_id: matchId, user_id: { [Op.ne]: ticTacToeMatch.turn } } });
  console.log(ticTacToeMatchPlayer);
  ticTacToeMatch.turn = ticTacToeMatchPlayer.user_id;
  await ticTacToeMatch.save();
  return ticTacToeMatchPlayer.user_id;
}

/**
 * Handles a user's move in a game.
 *
 * @param {object} options - An object containing the following properties:
 * @param {Socket} options.socket - The socket for the user.
 * @param {Server} options.io - The socket.io instance.
 * @param {number} options.move - The move made by the user.
 * @param {number} options.matchId - The ID of the match.
 * @param {number} options.playerId - The ID of the player.
 * @param {number} options.matchPlayerId - The ID of the match player.
 *
 * @returns {Promise<void>} A promise that resolves when the function is done.
 */
async function onUserMove({ socket, io, move, matchId, playerId, matchPlayerId }) {
  const match = await TicTacToeMatch.findOne({ where: { id: matchId, turn: playerId } });
  if (match == null) return socket.emit(MatchEvent.RoomMessage, "invalid move");

  await changeIdentifier(matchId);
  const moves = await TicTacToeMoves.create({ match_player_id: matchPlayerId, move: move.toString(), match_id: matchId });

  console.log(moves.toJSON());
  const gameInfo = await generateGameInfo(matchId);
  socket.broadcast.emit(MatchEvent.GameInfo, { moves: gameInfo.moves });

  /** Id of winner */
  const result = await checkWinner(socket, io, matchId);
  if (result == null) {
    await switchTurn(matchId)
    await initiateMove(socket, io, matchId, matchPlayerId); 
    // switch turn
  } else if (result === 0) {
    startNextRound(io, socket, matchId);
  } else {
    announceWinner(socket, io, matchId, result);
  }
}
// start generate Game Notification function
function generateGameNotification ({
  message,
  sentBy = "bot",
  messageType = MessageType.BotSuccess,
  card,
  user = {
    name: "Bot",
    id: -1
  },
  job
}) {
  return {
    message,
    sentBy,
    messageType,
    card,
    user,
    job
  };
}

/**
Checks for the winner in a Tic Tac Toe game based on the provided matchId.
** Step 1: Find all the moves of the current match
** Step 2: Fill up array of length 9 from the TicTacToeMoves Model. Put Id of User in each array from their moves. If nobody has make move in array index fill it up with null;
** Step 3: Check each row and column to see if there is any winning combination
** Step 4: If none found, then we need to find diagonal combinations
** Step 5: At last return winner
@param {Socket} socket - The socket object representing the current player.
@param {Server} io - The Socket.io server instance.
@param {number} matchId - The identifier of the Tic Tac Toe match to check for a winner.
@param {number} userId - The move of the current user
@returns {Promise<number|null>} - The winner's ID (1,2, ..., n) if there is a winner, 0 if the game is a draw, or null if there is no winner yet.
*/
async function checkWinner (socket, io, matchId) {
  const matchPlayers = await TicTacToeMatchPlayer.findAll({
    where: { match_id: matchId },
    include: [{ model: TicTacToeMoves }]
  });

  const filledUpMoves = fillUpMoves(matchPlayers);
  console.log(filledUpMoves);

  // check rows
  for (let i = 0; i < 9; i += 3) {
    if (filledUpMoves[i] && filledUpMoves[i] === filledUpMoves[i + 1] && filledUpMoves[i] === filledUpMoves[i + 2]) {
      return filledUpMoves[i];
    }
  }

  // check columns
  for (let i = 0; i < 3; i++) {
    if (filledUpMoves[i] && filledUpMoves[i] === filledUpMoves[i + 3] && filledUpMoves[i] === filledUpMoves[i + 6]) {
      return filledUpMoves[i];
    }
  }

  // check diagonals
  if (filledUpMoves[0] && filledUpMoves[0] === filledUpMoves[4] && filledUpMoves[0] === filledUpMoves[8]) {
    return filledUpMoves[0];
  }
  
  if (filledUpMoves[2] && filledUpMoves[2] === filledUpMoves[4] && filledUpMoves[2] === filledUpMoves[6]) {
    return filledUpMoves[2];
  }

  // If no winner and no null values, it's a draw
  if (!filledUpMoves.includes(null)) {
    return 0;
  }

  // If no winner yet
  return null;
}

/**
 * 
 * @param {number} matchId TicTacToe match id  
 * @returns {Promise<Date>} tis
 */
async function changeIdentifier(matchId) {
  const date = new Date();
  console.log(matchId);
  await TicTacToeMatch.update({ move_id: date.toString() }, { where: { id: matchId } });
  console.log(`Changing identifier ${date}`);
  return date;
}

/**
 * This asynchronous function checks if a match with a given identifier exists.
 * @async
 * @param {number} matchId - The ID of the match to check.
 * @param {Date} identifier - The identifier to check in the match.
 * @returns {Promise<boolean>} A promise that resolves to true if a match is found with the given identifier, and false if not.
 */
async function checkIdentifier(matchId, identifier) {
  const sqlDate = identifier.toString(); // Format for MySQL
  console.log(sqlDate);
  
  const lowCardMatch = await TicTacToeMatch.findOne({ where: { id: matchId, move_id: sqlDate } });
  if (lowCardMatch == null) return false;
  console.log(true)
  return true;
}

/**
 * This asynchronous function announces the winner of a Tic Tac Toe match.
 *
 * @async
 * @function announceWinner
 * @param {Socket} socket - The Socket object representing the connection between the server and the client.
 * @param {Server} io - The Server object representing the socket.io server instance.
 * @param {number} matchId - The unique identifier of the Tic Tac Toe match.
 * @param {number} winnerId - The unique identifier of the user who won the match.
 * @returns {Promise<void>} A Promise that resolves when the function has completed.
 *
 * @description
 * The function performs the following steps:
 * - Starts a new database transaction.
 * - Finds the Tic Tac Toe match by its primary key, including the associated players and users.
 * - Increments the cash point of the winner user by the match prize amount.
 * - Updates the match status to ideal, resets the prize, round, turn, and move id fields.
 * - Updates the bet amount of all the match players to zero.
 * - Commits the transaction to the database.
 * - Emits a WinnerAnnouncement event to the match room with the winner id.
 */
async function announceWinner(socket, io, matchId, winnerId) { 
  const transaction = await sequelize.transaction();
  const match = await TicTacToeMatch.findByPk(matchId, { include: [{ model: TicTacToeMatchPlayer, include: User }] }, transaction);
  await User.increment("cash_point", { by: match.prize, where: { id: winnerId }, transaction });
  await TicTacToeMatch.update({ game_status: GameStatus.Ideal, isBotActive: false, prize: 0, round: 1, turn: null, move_id: null }, { where: { id: matchId }, transaction });
  await TicTacToeMatchPlayer.update({ bet: 0 }, { where: { match_id: matchId }, transaction });
  await transaction.commit();
  io.to(matchId).emit(MatchEvent.WinnerAnnouncement, winnerId);
}

/**
 * 
 * @param {Array} matchPlayers - Instance of TicTacToeMatchPlayer with included their TicTacToeMoves
 * @return array of filledUpMoves; 
 */
function fillUpMoves(matchPlayers) {
  const filledUpMoves = Array(9).fill(null);
  for (const matchPlayer of matchPlayers) {
    for (const move of matchPlayer.tic_tac_toe_moves) {
      filledUpMoves[move.move] = matchPlayer.user_id;
    }
  }
  return filledUpMoves;
}

/**
 * This asynchronous function generates game information for a given Tic Tac Toe match.
 *
 * @param {number} matchId - The unique identifier for the Tic Tac Toe match.
 *
 * @returns 
 * @example
 * const gameInfo = await generateGameInfo(123);
 * console.log(gameInfo);
 */
async function generateGameInfo(matchId) { 
  const ticTacToeMatch = await TicTacToeMatch.findByPk(matchId, { include: [{ model: TicTacToeMatchPlayer, include: [{ model: TicTacToeMoves }, { model: User }] }] });
  const filledUpMoves = fillUpMoves(ticTacToeMatch.tic_tac_toe_match_players);
  const gameInfo = {};
  gameInfo.moves = filledUpMoves;
  gameInfo.gameStatus = ticTacToeMatch.game_status;
  gameInfo.turn = ticTacToeMatch.turn;
  gameInfo.round = ticTacToeMatch.round;
  gameInfo.players = [];
  for (const ticTacMatchPlayer of ticTacToeMatch.tic_tac_toe_match_players) {
    const user = {};
    user.name = ticTacMatchPlayer.user.name;
    user.id = ticTacMatchPlayer.user.id;
    user.bet = ticTacMatchPlayer.bet;
    user.image = ticTacMatchPlayer.user.image;
    console.log("=>=>=>==>=>===>=======");
    console.log(ticTacMatchPlayer);
    gameInfo.players.push(user);
  }
  return gameInfo;
}

/**
 * @param {Date} startTime
 * @param {number} turn 
 * @param {string} gameStatus
 * @returns
 */
function generateStartTime(startTime, turn, gameStatus) {
  return {
    start_time: startTime,
    turn: turn,
    game_status: gameStatus
  }
}

/**
 * Start next round. This function runs on final round as well as other round.
 * @param {Server} io 
 * @param {Socket} socket 
 * @param {number} matchId Id of low card game that is about to restart
 */
async function startNextRound(io, socket, matchId) {
  console.time("Execution Time");
  io.to(matchId).emit(MatchEvent.GameStatus, GameStatus.Draw);

  await TicTacToeMatch.update({ gameStatus: GameStatus.Draw }, { where: { id: matchId } });
  await TicTacToeMatch.increment("round", { where: { id: matchId }, by: 1 });
  await TicTacToeMoves.destroy({ where: { match_id: matchId } });
  await switchTurn(matchId);
  const matchPlayers = await TicTacToeMatchPlayer.findAll({ where: { match_id: matchId } });
  for (const matchPlayer of matchPlayers) {
    await matchPlayer.increment("bet", { by: 10 });
    await TicTacToeMatch.increment("prize", { by: 10, where: { id: matchId } });
  }
  const gameInfo = await generateGameInfo(matchId);
  io.to(matchId).emit(MatchEvent.DrawInfo, { moves: gameInfo.moves, players: gameInfo.players, gameStatus: gameInfo.gameStatus, round: gameInfo.round });
  console.timeEnd("Execution Time");
  console.time("delay");
  await delay(3600)
  console.timeEnd("delay");
  initiateMove(socket, io, matchId, matchId);
}
 
/**
 * 
 * @param {Socket} socket 
 * @param {Server} io 
 * @param {number} matchId 
 */
async function makeMoveForUser(socket, io, matchId) {
  const ticTacToeMatch = await TicTacToeMatch.findByPk(matchId, { include: { model: TicTacToeMatchPlayer, include: [{ model: TicTacToeMoves }, { model: User }] } });
  const filledUpMoves = fillUpMoves(ticTacToeMatch.tic_tac_toe_match_players);
  const unusedBoard = getUnusedBoard(filledUpMoves);
  const currentPlayer = ticTacToeMatch.tic_tac_toe_match_players.find(player => player.user_id === ticTacToeMatch.turn);
  await TicTacToeMoves.create({ move: unusedBoard, match_id: matchId, match_player_id: currentPlayer.id });

  const gameInfo = await generateGameInfo(matchId);
  io.to(matchId).emit(MatchEvent.GameInfo, { moves: gameInfo.moves });

  const result = await checkWinner(socket, io, matchId);

  if (result == null) {
    await switchTurn(matchId)
    await initiateMove(socket, io, matchId);
    // switch turn
  } else if (result === 0) {
    startNextRound(io, socket, matchId);
  } else {
    announceWinner(socket, io, matchId, result);
  }
}

/**
 * 
 * @param {Array} filledUpMoves 
 */
function getUnusedBoard(filledUpMoves) {
  let i;
  do {
    i = Math.floor(Math.random() * 9);
  } while (filledUpMoves[i] !== null);
  return i;
}
/**
 * 
 * @param {NodeJS.Timeout} interval
 * @param {NodeJS.Timeout} timeOut 
 */
function clearIntervalAndTimeout(interval, timeOut) {
  clearInterval(interval);
  clearTimeout(timeOut)
  interval = null;
  timeOut = null;
}

/**
 * 
 * @param {Socket} socket 
 * @param {Server} io 
 * @param {number} matchId The id of TicTacToeMatch from which user exited
 * @param {number} userId The id of user who left the room
 */
async function leaveTicTacToeRoom(socket, io, matchId, userId) {
  const ticTacMatchPlayers = await TicTacToeMatchPlayer.findAll({ where: { match_id: matchId } });
  const ticTacToeMatch = await TicTacToeMatch.findByPk(matchId);

  if (ticTacMatchPlayers.length < 2 && ticTacToeMatch.game_status === GameStatus.Ideal.toLowerCase()) {
    console.table("This is the first data");
    // if i am the only one player in the room and game is still in ideal position.
    // i.e. nobody has joined the game in the course of leaving room
    // return the game_point back to user
    for (const ticTacMatchPlayer of ticTacMatchPlayers) {
      await User.increment("game_point", { by: ticTacMatchPlayer.bet, where: { id: ticTacMatchPlayer.user_id } });
      await TicTacToeMatch.decrement("prize", { by: ticTacMatchPlayer.bet, where: { id: ticTacMatchPlayer.match_id } });
    }
    resetRoom(matchId);
    return;
  }

  if (ticTacMatchPlayers.length < 2 && ticTacToeMatch.game_status !== GameStatus.Ideal.toLowerCase()) {
    // if last remaining user left after initiating move
    resetRoom(matchId);
    return;
  }

  if (ticTacMatchPlayers.length === 2 && ticTacToeMatch.game_status === GameStatus.Starting.toLowerCase()) {
    // If both member joined but game is starting yet but has not initiated move
    // return the game_point back to user
    for (const ticTacMatchPlayer of ticTacMatchPlayers) {
      await User.increment("game_point", { by: ticTacMatchPlayer.bet, where: { id: ticTacMatchPlayer.user_id } });
      await TicTacToeMatch.decrement("prize", { by: ticTacMatchPlayer.bet, where: { id: ticTacMatchPlayer.match_id } });
      if (ticTacMatchPlayer.user_id === userId) await ticTacMatchPlayer.destroy();
    }
    socket.broadcast.emit(MatchEvent.Cancelled, null);
    return;
  } 

  if (ticTacMatchPlayers.length === 2) {
    // if both user joined the game and then one player left room after initiating move
    for (const ticTacMatchPlayer of ticTacMatchPlayers) {
      if (ticTacMatchPlayer.user_id === userId) {
        await ticTacMatchPlayer.destroy();
        continue;
      }

      announceWinner(socket, io, matchId, ticTacMatchPlayer.user_id);
    }
    resetRoom(matchId);
  }
}

/**
 * 
 * @param {number} matchId
 */
async function resetRoom(matchId) {
  await TicTacToeMatchPlayer.destroy({ where: { match_id: matchId } });
  await TicTacToeMatch.update({ round: 1, prize: 0, game_status: GameStatus.Ideal, isBotActive: false, turn: null, move_id: null }, { where: { id: matchId } });
}

module.exports = { waitForPlayer, onUserMove, switchTurn, initiateMove, findAndJoinRoom, checkWinner, leaveTicTacToeRoom, generateGameInfo };
