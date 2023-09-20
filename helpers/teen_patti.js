const { Socket, Server } = require("socket.io");
// const {
//   LowCardMatchPlayer,
//   LowCardMatch,
//   LowCardMessages
// } = require("../model/config/relations");

const { MessageType, MatchResult, GameStatus, MatchEvent, Rank, HandRanking, SentBy } = require("../model/enums");
const User = require("../model/databases/user");
const sequelize = require("../model/config/config");
const { shuffleArray } = require("./shuffle");
const TeenPattiMatch = require("../model/databases/teen_patti_match");
const TeenPattiMatchPlayer = require("../model/databases/teen_patti_match_player");
const TeenPattiMatchMessages = require("../model/databases/teen_patti_match_messages");
const TeenPattiHandRanking = require("../model/teen_patti_hand_ranking");
const Card = require("../model/card");
// eslint-disable-next-line no-unused-vars
const { Model } = require("sequelize");
const CountryReward = require("../model/databases/country_reward");

// this is private function
async function checkOrChangeMatchAvability(matchId, isBotActive = false) {
  // first check if the match is in ideal state
  // if it is in ideal state then change it to starting state and return true
  // this is because to allow only first player can start game
  // once the game is started other cant start the game
  const match = await TeenPattiMatch.findByPk(matchId);

  if (match.getDataValue("gameStatus") === "ideal") {
    match.set("isBotActive", isBotActive);
    match.set("gameStatus", "starting");
    match.save();
    return true;
  }
  return false;
}

async function checkOrChangeStatusToPlaying(matchId, isBotActive = false) {
  // if game status is prevously starting then update and return true
  // else return false
  // false is to emmit nothing
  // true to emit message game status changed to playing
  const match = await TeenPattiMatch.findByPk(matchId);
 
  if (match.getDataValue("gameStatus") !== "starting") {
    return false;
  }
  match.set("isBotActive", isBotActive);
  match.set("gameStatus", "playing");
  match.save();
  return true;
}

// this is private function 

async function checkStatusToJoiningAvailability(matchId, isBotActive = false) {
  // return true if user is applcable to join
  // else return false 
  console.log(matchId);
  const match = await TeenPattiMatch.findByPk(matchId);
  console.log(match.getDataValue("gameStatus"));

  if (match.getDataValue("gameStatus") === "joining") {
    return true;
  }

  return false;
}

async function checkStatusToShowingAvailability(teenPattiMatchPlayerId, isBotActive = false) {
  // return true if user is applcable to join
  // else return false

  const matchPlayer = await TeenPattiMatchPlayer.findOne({ 
    where: { id: teenPattiMatchPlayerId, is_playing: true, shown: false },
    include: { model: TeenPattiMatch, where: { gameStatus: "playing" } } 
  });

  if (matchPlayer && matchPlayer.is_playing === true) {
    return true;
  }

  return false;
}

async function onJoinGame({ socket = new Socket(), io = new Server(), matchId, userId }) {
  const ifJoinGameAvailable = await checkStatusToJoiningAvailability(matchId);

  if (!ifJoinGameAvailable) return;
  const user = await User.findByPk(userId);
  if (user.play_point < 10) {
    const message = generateGameNotification({
      message: "Sorry! you do not have enough GP to join game",
      messageType: MessageType.BotDanger,
      user
    });
    socket.emit("roomMessage", message)
    return;
  }

  const transaction = await sequelize.transaction();
  const match = await TeenPattiMatch.findByPk(matchId);
  const teenPattiMatchPlayer = await TeenPattiMatchPlayer.findOne({ where: { match_id: matchId, user_id: userId } });

  let userPp = user.getDataValue("play_point");
  userPp = userPp - 10;
  let matchPrize = match.getDataValue("prize");
  matchPrize = matchPrize + 10;

  teenPattiMatchPlayer.set("is_playing", true);
  user.set("play_point", userPp);
  match.set("prize", matchPrize);
  await user.save({ transaction });
  await match.save({ transaction })
  await teenPattiMatchPlayer.save({ transaction });
  await transaction.commit();
  
  const message = generateGameNotification({
    message: "joined the game",
    user: user.toJSON(),
    job: "append"
  });
  io.to(matchId).emit("roomMessage", message);
  io.to(matchId).emit("amIActive", true)
}

/**
 * This function is called when the first emits start match event.
 * If second person also calls same function his request will be ignored
 * @param {Object} options Configurations to start match
 * @param {Socket} options.socket Socket connection of currently connected user
 * @param {Server} options.io Server connections of currently connected user
 * @param {Number} options.matchId Id of currently playing game
 */
async function startMatch (options) { 
  const { socket, io, matchId } = options;
  if (!(await checkOrChangeMatchAvability(matchId))) {
    return;
  }
      
  io.to(matchId).emit("gameStatus", "starting");

  const message = generateGameNotification({ message: "game has started" });
  io.to(matchId).emit("roomMessage", message);

  const match = await TeenPattiMatch.findByPk(matchId);
  match.setDataValue("gameStatus", "joining");
  await match.save();
  // change match status to joining
  io.to(matchId).emit("startTime", new Date());
  io.to(matchId).emit("gameStatus", "joining");
  // pass the message to user after

  setTimeout(async () => {
    // set game status to playing after 15 sec
    // waiting is needed to shuffle

    await TeenPattiMatch.update({ gameStatus: "waiting" }, { where: { id: matchId } });

    io.to(matchId).emit("gameStatus", "waiting");
    const { rows, count } = await TeenPattiMatchPlayer.findAndCountAll({ where: { is_playing: true, match_id: matchId }, include: [TeenPattiMatch, User] });
    console.log(count);
    if (count < 2) {
      // if there is no more than 1 player joined game cancel the game
      for (const matchPlayer of rows) {
        let playerPoint = matchPlayer.user.play_point;
        playerPoint += 10;
        await User.update({ play_point: playerPoint }, { where: { id: matchPlayer.user.id } });
        matchPlayer.set("is_playing", false);
        await matchPlayer.save();
      }
      await TeenPattiMatch.update({ gameStatus: "ideal", prize: 0 }, { where: { id: matchId } });
      const message = generateGameNotification({
        messageType: MessageType.BotDanger,
        message: "Nobody joined this game. Ending the match now"
      });
      io.to(matchId).emit("roomMessage", message);
      io.to(matchId).emit("gameStatus", "ideal");
      return;
    }

    const message = generateGameNotification({
      messageType: MessageType.BotInfo,
      message: `${count} players joined this game. Winner will take ${count * 10} CP.`
    });
    io.to(matchId).emit("roomMessage", message);

    await shuffleAndDistributeCard({
      io,
      socket,
      teenPattiMatchId: matchId
    });

    await TeenPattiMatch.update({ gameStatus: "playing" }, { where: { id: matchId } })

    io.to(matchId).emit("startTime", new Date());
    io.to(matchId).emit("gameStatus", "playing");
        
    setTimeout(async() => {
      // checkWinner after the 15 second of playing time that is given to user.
      // in this time they can show their card or gets eliminated. 
      await TeenPattiMatch.update({ gameStatus: "waiting" }, { where: { id: matchId } })
      io.to(matchId).emit("gameStatus", "waiting");
      const message = generateGameNotification({
        message: "Checking winner. Please wait!",
        messageType: MessageType.BotInfo
      });
      io.to(matchId).emit("roomMessage", message);

      /**
       * Passive users are those who did not show card within 15 second after receiving the cards
       * @type {number}
       */
      const passiveUsers = await eliminatePassiveUser({ io, socket, lowCardMatchId: matchId });
       
      // finding count and user user playing in provided match
      const { rows: matchPlayers, count: totalUser } = await TeenPattiMatchPlayer.findAndCountAll({
        where: {
          match_id: matchId,
          is_playing: true,
          shown: true
        },
        include: [
          {
            model: TeenPattiMatch 
          },
          {
            model: TeenPattiMatchMessages 
          },
          {
            model: User 
          }
        ]
      });

      if (totalUser === 0) {
        // if Nobody shows their card then end this game
        await TeenPattiMatch.update({ prize: 0, gameStatus: GameStatus.Ideal }, { where: { id: matchId } });
        io.to(matchId).emit("amIActive", false);
        io.to(matchId).emit("gameStatus", GameStatus.Ideal.toLowerCase());
        const message = generateGameNotification({ message: "Nobody won this round", messageType: MessageType.BotDanger });
        io.to(matchId).emit("roomMessage", message);
        io.to(matchId).emit(MatchEvent.GameInfo, await generateGameInfo())
        return;
      }

      if (totalUser <= 5) {
        // if this is a last round
        const result = await checkWinner(socket, io, matchId, matchPlayers);
        // now to to 
        if (result === null) {
          await restartDrawGame({ socket, io, matchId });
          return;
        }

        await announceWinner({ socket, io, handRank: result }, matchId)
        io.to(matchId).emit(MatchEvent.GameInfo, await generateGameInfo(matchId))
        return;
      }

      if (passiveUsers >= 5) {
        restartNextRound();
        return;
      }   

      await eliminateUser({ passiveUsers, rows: matchPlayers, matchId });
      restartDrawGame();
    }, 15000);
  }, 15000);
}

/**
 * This asynchronous function allows a user to join a Teen Patti room.
 *
 * @param {number} matchId - The unique identifier of the match.
 * @param {number} userId - The unique identifier of the user.
 * @param {string} socketId - The unique identifier of the socket connection.
 *
 * @returns {Promise<Model>} A promise that resolves to a TeenPattiMatchPlayer object.
 *
 * The function works as follows:
 * 1. It creates a new TeenPattiMatchPlayer with the provided match ID, user ID, and socket ID.
 * 2. It returns a promise that resolves to the newly created TeenPattiMatchPlayer object.
 */
async function joinTeenPattiRoom (matchId, userId, socketId) {
  console.log(`socket_id: ${socketId}`);
  const teenPattiMatchPlayer = await TeenPattiMatchPlayer.create({ match_id: matchId, user_id: userId, socket_id: socketId });
  return teenPattiMatchPlayer;
}

// start generate Game Notification function
function generateGameNotification ({
  message,
  sentBy = "bot",
  messageType = MessageType.BotSuccess,
  card,
  user = {
    name: "Bot",
    id: 1
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
 * Checking winner from the last round. this functions executes only on the last round.
 * This functions determines wether game is draw, or winner when the user <= 5
 * @param {Socket} socket 
 * @param {Server} io 
 * @param {Number} matchId TeenPattiMatchID
 * @param {Array<Model>} rows 
 * @returns {Promise<TeenPattiHandRanking?>} Returns the MatchResult. Null if Draw
 */
async function checkWinner (socket, io, matchId, rows) {  
  /** @type {Array<TeenPattiHandRanking>} Lists of sorted HandRank */
  const handRanking = getSortedHandRanking(rows);
 
  const highestHandRank = Math.max(...handRanking.map(item => item.handRank)); // finding the highest hand rank

  /** 
   * @type {Array<TeenPattiHandRanking>}
   *  Lists of filtered elements with the highest handRank
   */
  const highestRankingElements = handRanking.filter(item => item.handRank === highestHandRank);

  if (highestRankingElements.length === 1) {
    return (highestRankingElements[0]);
  }
  const winner = checkCardUnit(highestRankingElements);
  return winner;
}

// this is private function
async function chooseWinner({ totalUser, matchPlayer = [], matchId, io = new Server() }) {
  if (totalUser === 0) {
    await TeenPattiMatch.update({ prize: 0, gameStatus: GameStatus.Ideal }, { where: { id: matchId } });
    io.to(matchId).emit("amIActive", false);
    io.to(matchId).emit("gameStatus", GameStatus.Ideal.toLowerCase());
    const message = generateGameNotification({ message: "Nobody won this round", messageType: MessageType.BotDanger });
    io.to(matchId).emit("roomMessage", message);
    return;
  }
  if (totalUser === 1) {
    const match = await TeenPattiMatch.findByPk(matchId);
    const winner = await User.findByPk(matchPlayer[0].user_id);
    const prize = match.getDataValue("prize");
    const userCp = winner.getDataValue("cash_point") + prize;
    match.set("gameStatus", "ideal");
    match.set("prize", 0); 
    match.set("isBotActive", false);
    await match.save()
    winner.set("cash_point", userCp);
    matchPlayer[0].set("is_playing", false);
    matchPlayer[0].set("shown", false);
    await matchPlayer[0].save();
    await winner.save();

    await TeenPattiMatchMessages.destroy({ where: { match_id: matchId } });
    io.to(matchId).emit("amIActive", false);
    io.to(matchId).emit("gameStatus", GameStatus.Ideal.toLowerCase());
    const message = generateGameNotification({ message: "won this game", user: winner, job: "append" });
    io.to(matchId).emit("roomMessage", message);
    return;
  }
  const firstUserRank = JSON.parse(matchPlayer[0].teen_patti_match_message.card).rank;
  const secondUserRank = JSON.parse(matchPlayer[1].teen_patti_match_message.card).rank;
  // console.log(JSON.parse(matchPlayer[0].low_card_match_message.card));
  // console.log("first user rank"+ firstUserRank);
  // console.log("second user rank"+ secondUserRank);
  if (firstUserRank === secondUserRank) {
    return MatchResult.Draw
  }

  const transaction = await sequelize.transaction();
  const match = await TeenPattiMatch.findByPk(matchId, { transaction });
  const winner = await User.findByPk(matchPlayer[0].user_id, { transaction });
  const prize = match.getDataValue("prize");
  const userCp = winner.getDataValue("cash_point") + prize;
  match.set("gameStatus", "ideal");
  match.set("prize", 0); 
  match.set("isBotActive", false);
  await match.save({ transaction })
  winner.set("cash_point", userCp);
  await winner.save();

  for (const user of matchPlayer) {
    user.set("is_playing", false);
    user.set("shown", false);
    await user.save({ transaction });
  }  
  await TeenPattiMatchMessages.destroy(
    { where: { match_id: matchId } });
  await transaction.commit();

  io.to(matchId).emit("gameStatus", GameStatus.Ideal.toLowerCase());
  io.to(matchId).emit("amIActive", false);
  const message = generateGameNotification({
    messageType: MessageType.WinnerAnnouncement,
    message: `Congratulation ${winner.getDataValue("name")} on wining ${prize} CP`,
    card: JSON.parse(matchPlayer[0].teen_patti_match_message.card),
    user: {
      name: winner.getDataValue("name"),
      id: winner.getDataValue("id")
    }
  });
  io.to(matchId).emit("roomMessage", message);

  return MatchResult.Finished;
}

/**
 * Forwards message emitted by user to all the users who has joined the game.
 * This is not a private message
 * @param {Socket} socket 
 * @param {Server} io 
 * @param {number} matchId
 * @param {String} message 
 * @param {number} userId 
 */
async function forwardMessage (socket, io, message, matchId, userId) {
  const user = await User.findByPk(userId);
  const generatedMessage = generateGameNotification({ message, messageType: MessageType.UserMessage, sentBy: SentBy.User, user });
  console.log(generatedMessage)
  console.log(matchId)
  console.log(MatchEvent.RoomMessage);
  io.to(matchId).emit(MatchEvent.RoomMessage, generatedMessage);
  socket.to(matchId).emit(MatchEvent.RoomMessage, generatedMessage);
}

/**
 * 
 * @param {Object} options
 * @param {Array<Model>} options.rows
 * @param {number} options.passiveUsers 
 * @param {number} options.matchId
 */
async function eliminateUser({ rows, passiveUsers, matchId }) {
// Initialize an array to store the temporarily removed lowest hand ranks.
  const removedHandRanks = [];  
  let handRanking = getSortedHandRanking(rows);
  // totalUser = 12;
  // passiveUsers = 2  
  let indexLength = 5;
  const totalUser = rows.length;
  if (totalUser < 10) {
    // if total user is 9-6 then eliminate user to keep 5 users at the end 
    indexLength = totalUser % 5;
  }  
  for (let i = passiveUsers; i <= indexLength;) {
    const lowestRank = Math.min(...handRanking.map(item => item.handRank)); // finding the lowest hand rank
    // now find the count of lowest hand rank in the array handRanking
    let lowestHandRanks = handRanking.filter(item => item.handRank === lowestRank);
    lowestHandRanks = sortCardUnit(lowestHandRanks);
    const toBeEliminatedPlayers = 5 - i;
    if (lowestHandRanks.length >= toBeEliminatedPlayers) {
      removedHandRanks.push(...lowestHandRanks.slice(0, toBeEliminatedPlayers - 1))
      i += lowestHandRanks.length;
    } else {
      removedHandRanks.push(...lowestHandRanks.slice(0, lowestHandRanks.length - 1));
      i += lowestHandRanks.length;
    }
    // remove elements from the  handRanking which are in the removedHandRanks. This is not implemented yet
    handRanking = handRanking.filter(item => !removedHandRanks.includes(item));
  }
  /** The Teen patti match players who needs to be removed */
  const toBeRemovedPlayers = await TeenPattiMatchPlayer.findAll({ 
    where: {
      match_id: matchId,
      user_id: {
        in: removedHandRanks.map(element => element.user.user_id)
      }
    }
  });
}

async function restartDrawGame({ socket = new Socket(), io = new Server(), matchId = 0 }) { 
  await TeenPattiMatch.update({ gameStatus: "waiting" },
    {
      where: {
        id: matchId
      }
    });
  io.to(matchId).emit("gameStatus", "waiting")

  const message = generateGameNotification({
    message: "Please wait! Shuffling card"
  });
  io.to(matchId).emit("roomMessage", message);

  await TeenPattiMatchMessages.destroy({
    where: {
      match_id: matchId
    }
  })
 
  await shuffleAndDistributeCard({ io, socket, teenPattiMatchId: matchId });
  await TeenPattiMatch.update({ gameStatus: "playing" },
    {
      where: {
        id: matchId
      }
    });

  io.to(matchId).emit("startTime", new Date());
  io.to(matchId).emit("gameStatus", "playing")

  setTimeout(async() => {
    await eliminatePassiveUser({ io, socket, matchId })
    const rows = await TeenPattiMatchPlayer.findAll({
      where: {
        match_id: matchId,
        is_playing: true,
        shown: true
      },
      include: [
        {
          model: TeenPattiMatch // Include the LowCardMatch association
        },
        {
          model: TeenPattiMatchMessages // Include the LowCardMessages association
        },
        {
          model: User // Include the LowCardMessages association
        }
      ]
    });
    const matchResult = await checkWinner(socket, io, matchId, rows);
    if (matchResult === null) {
      restartDrawGame({ socket, io, matchId });
      return;
    }
    announceWinner({ socket, io, handRank: matchResult }, matchId);
  }, 1500);
}

/**
 * Removes the number of passive users who did not show their cards
 * after a specified time period (e.g., 20 seconds) since joining the game.
 * @returns {Promise<Number>} The number of deleted passive users.
 */
async function eliminatePassiveUser ({ io = new Server(), socket = new Socket(), lowCardMatchId }) {
  // passive users are those who did not show their card after the 20 sec of joining the game
  const { rows, count } = await TeenPattiMatchPlayer.findAndCountAll({ where: { match_id: lowCardMatchId, is_playing: true, shown: false }, include: User });
 
  if (count === 0) return count;

  for (const lowCardPlayer of rows) {
    lowCardPlayer.set("is_playing", false);
    lowCardPlayer.set("shown", false);
    await lowCardPlayer.save();
    await TeenPattiMatchMessages.destroy({ where: { match_player_id: lowCardPlayer.getDataValue("id") } });
    const message = generateGameNotification({ message: "packed the round", messageType: MessageType.BotDanger, user: lowCardPlayer.user, job: "append" });
    io.to(lowCardMatchId).emit("roomMessage", message);
  }  

  return count;
}

/**
 * Shuffles from the deck of 52 cards and distribute 3 cards to each player.
 * @param {Object} options - An object containing configuration options.
 * @param {Server} options.io - A parameter representing a Socket.IO server instance.
 * @param {Socket} options.socket - A parameter representing a Socket.IO socket instance.
 * @param {number} options.teenPattiMatchId - The Teen Patti match ID as an integer.
 * @returns {Promise<void>} This function does not returns anything all the tasks are performed inside
 */
async function shuffleAndDistributeCard(options) {
  const { io, socket, teenPattiMatchId } = options;

  let message = generateGameNotification({
    message: "Shuffling cards",
    messageType: MessageType.BotSuccess
  });
  io.to(teenPattiMatchId).emit("roomMessage", message);

  const shuffledCard = shuffleArray();

  // fetch all the players who have joined current room and joined the game in within 15 sec.
  const joinedPlayers = await TeenPattiMatchPlayer.findAll({
    include: User,
    where: {
      match_id: teenPattiMatchId,
      is_playing: true
    }
  });

  const playersCards = [];
  console.log(shuffledCard);
  for (let index = 0; index < joinedPlayers.length; index++) {
    const data = {};
    const cards = [];

    for (let index = 0; index < 3; index++) {
      // Select 3 random card to each player from the deck of 52 shuffledCard
      // after selecting each card remove the selected card from shuffledCard using randomIndex
      const randomIndex = Math.floor(Math.random() * shuffledCard.length);
      console.log(shuffledCard[randomIndex]);
      console.log(randomIndex);
      cards.push(shuffledCard[randomIndex].toJson());
      shuffledCard.splice(randomIndex, 1);
    }
    console.log(shuffledCard); 
    data.card = cards;
    data.user_id = joinedPlayers[index].user_id;
    data.match_id = teenPattiMatchId;
    data.match_player_id = joinedPlayers[index].getDataValue("id");
    playersCards.push(data);

    message = generateGameNotification({
      card: data.card,
      messageType: MessageType.CardShow,
      user: joinedPlayers[index].getDataValue("user")
    });
    // emmit respective card to each player that is saved in database
    io.to(joinedPlayers[index].getDataValue("socket_id")).emit("roomMessage", message);
  }

  await TeenPattiMatchMessages.bulkCreate(playersCards);

  socket.emit("room", playersCards);
  if (!(await checkOrChangeStatusToPlaying(teenPattiMatchId))) {
    return;
  }
 
  socket.emit("gameStatus", "playing");
}

async function onCardShow({ socket = new Socket(), io = new Server(), userId, matchId, teenPattiMatchPlayerId }) {
  console.log(`===> ${teenPattiMatchPlayerId} match_id=${matchId} user_id ${userId}`);
  if (!await checkStatusToShowingAvailability(teenPattiMatchPlayerId)) {
    const message = generateGameNotification({ message: "You are not in this game", messageType: MessageType.BotDanger });
    socket.emit(MatchEvent.RoomMessage, message);
    return;
  }
  const matchPlayer = await TeenPattiMatchPlayer.findOne({ 
    where: { match_id: matchId, user_id: userId, is_playing: true }, 
    include: [{ model: TeenPattiMatchMessages }, { model: User }] 
  });

  if (matchPlayer == null) {
    const message = generateGameNotification({ messageType: MessageType.BotDanger, message: "You are not in this game" });
    socket.emit(message);
    return;
  }

  matchPlayer.set("shown", true);
  await matchPlayer.save();
  const message = generateGameNotification({ card: JSON.parse(matchPlayer.teen_patti_match_message.card), messageType: MessageType.CardShow, user: matchPlayer.user });
  io.to(matchId).emit("roomMessage", message);
}

/**
 * Generates game information for the provided matchId. This includes the count of users who have joined the game, their cards, and user information.
 * The client-side is responsible for displaying a user's card. If a user has shown their card, it should be visible; otherwise, the backside of the card should be shown.
 * 
 * @param {number} matchId - The ID of the match for which game information is generated.
 * @returns {Promise} - A promise that resolves to the game information.
 */
async function generateGameInfo(matchId) { 
  try {
    return await TeenPattiMatch.findOne(
      {
        where: { id: matchId },
        attributes: {
          include: [  
            [
              sequelize.literal(
                "(Select COUNT(*) FROM teen_patti_match_players WHERE teen_patti_match_players.match_id = teen_patti_match.id AND is_playing = 1)"
              ),
              "playerCount"
            ]
          ]
        },
        include: { model: TeenPattiMatchPlayer, where: { is_playing: true }, required: false, include: [TeenPattiMatchMessages, User]/*, where: { is_playing: true } */ }
      });
  } catch (err) {
    return err;
  }
}

/**
 * This functions announces the winner of the game. And rewards him on game won
 * @param {Object} options 
 * @param {Socket} options.socket
 * @param {Server} options.io
 * @param {TeenPattiHandRanking} options.handRank of the winner player
 * @param {number} matchId TeenPattiMatchID
 */
async function announceWinner(options, matchId) {
  const { socket, io, handRank } = options;

  const teenPattiMatch = await TeenPattiMatch.findByPk(matchId);
  const userCp = handRank.user.cash_point + teenPattiMatch.prize;
  await User.update({ cash_point: userCp }, { where: { id: handRank.user.id } });
  teenPattiMatch.set("prize", 0);
  teenPattiMatch.set("gameStatus", GameStatus.Ideal);
  await teenPattiMatch.save();
  await TeenPattiMatchPlayer.update({ is_playing: false, shown: false }, { where: { match_id: matchId } });
  await TeenPattiMatchMessages.destroy({ where: { match_id: matchId } });

  const message = generateGameNotification({ message: "won this round", messageType: MessageType.WinnerAnnouncement, card: handRank.cards, user: handRank.user, job: "append" });
  io.to(matchId).emit(MatchEvent.RoomMessage, message);
  io.to(matchId).emit(MatchEvent.GameStatus, GameStatus.Ideal.toLowerCase());
  io.to(matchId).emit(MatchEvent.AmIActive, false);
}

async function restartNextRound(){

}

/**
 * This function rakes the list of players and sorts them according to handRank. e.g., Trial, PureSequence, Sequence,....
 * @param {Array<Model>} rows initial TeenPattiMatchPlayers without sorting
 * @returns {Array<TeenPattiHandRanking>} the list of sorted HandRanking
 */
function getSortedHandRanking(rows) {
  console.log(rows.length);
  const handRanking = [];
  for (let index = 0; index < rows.length; index++) {
    // looping through each match player
    const cardsJson = JSON.parse(rows[index].teen_patti_match_message.card);

    /** @type {Array<Card>} -This is the list of Decoded card model after querying from the database */
    const cards = [];

    /** Current user of the loop */
    const user = rows[index].user.toJSON()

    for (const card of cardsJson) {
      cards.push(new Card(card.rank, card.suits))
    }
    cards.sort((a, b) => a.rank - b.rank); // sorting cards
    
    if (checkTrial(cards)) {
      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.Trail, 0, user, cards);
      handRanking.push(teenPattiHandRanking);
    } else if (checkPureSequence(cards)) {
      // we are not checking AQK Pure sequence here to save cpu cycle
      // we will check that while matching color as it helps to save cpu cycle
      if (checkAceTwoThreePureSequence(cards)) {
        const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.AceTwoThreePureSequence, 0, user, cards);
        handRanking.push(teenPattiHandRanking);
        continue;
      } 

      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.PureSequence, 0, user, cards);
      handRanking.push(teenPattiHandRanking);
    } else if (checkSequence(cards)) {
      if (checkAceTwoThreeSequence(cards)) {
        const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.AceTwoThreeSequence, 0, user, cards);
        handRanking.push(teenPattiHandRanking);
        continue;
      }

      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.Sequence, 0, user, cards);
      handRanking.push(teenPattiHandRanking);
    } else if (checkColor(cards)) {
      if (checkAceQueenKingSequence(cards)) {
        // checking 0, 11 ,12 pure sequence here because it is not sequence as 123 or 456
        // so checking here and random cards also falls down here
        const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.AceQueenKingPureSequence, 0, user, cards);
        handRanking.push(teenPattiHandRanking);
        continue;
      }
      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.Color, 0, user, cards);
      handRanking.push(teenPattiHandRanking);
    } else if (checkPair(cards)) {
      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.Pair, 0, user, cards);
      handRanking.push(teenPattiHandRanking);
    } else {
      if (checkAceQueenKingSequence(cards)) {
        const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.AceQueenKingSequence, 0, user, cards);
        handRanking.push(teenPattiHandRanking);
        continue;
      }
     
      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.HighCard, 0, user, cards);
      handRanking.push(teenPattiHandRanking);
    }
  } // loop ends here

  handRanking.sort((a, b) => a.handRank - b.handRank);
  return [...handRanking];
}

/**
 * Checks if the given card has Trial or Not. e.g., AAA, 222
 * @param {Array<Card>} hand 
 * @returns {Boolean}
 */
function checkTrial(hand) {
  return hand[0].rank === hand[1].rank && hand[1].rank === hand[2].rank;
}

/**
 * check if the given sets of card has pure sequence or not.Example 5♥6♥7♥.
 * Note:- This does not include A23 and AQK 
 * @param {Array<Card>} cards
 * @returns {Boolean}
 */
function checkPureSequence(cards) {
  return (
    cards[0].suits === cards[1].suits &&
    cards[1].suits === cards[2].suits &&
    cards[0].rank + 1 === cards[1].rank &&
    cards[1].rank + 1 === cards[2].rank
  );
}

/**
 * check if the given sets of card has pure sequence of A23.
 * Example A♥2♥3♥
 * @param {Array<Card>} cards
 * @returns {Boolean}
 */
function checkAceTwoThreePureSequence(cards) {
  // not checking color because the sequence is checked only after checking pure sequence
  // again checking color would be repetitive
  return (
    cards[0].rank === Rank.Ace &&
    cards[1].rank === Rank.Two &&
    cards[2].rank === Rank.Three
  );
}

/**
 * check if the given sets of card has sequence of A23.
 * This method doesnot have seperate methods for checking pure sequence or only sequence.
 * Because for pure sequence it is checked under color and for sequence it is check under high card
 * Example A♥2♥3♥
 * @param {Array<Card>} cards
 * @returns {Boolean}
 */
function checkAceQueenKingSequence(cards) {
  // not checking color because the sequence is checked only after checking pure sequence
  // again checking color would be repetitive
  return (
    cards[0].rank === Rank.Ace &&
    cards[1].rank === Rank.Queen &&
    cards[2].rank === Rank.King
  );
}

/**
 * check if the given sets of card has sequence of Rank. Examlple:- 3♥4♣5♦
 * Note:- This does not include AQK and 123
 * @param {Array<Card>} cards
 * @returns {Boolean}
 */
function checkSequence(cards) {
  // not checking color because the sequence is checked only after checking pure sequence
  // again checking color would be repetitive
  return (
    cards[0].rank.index + 1 === cards[1].rank.index &&
    cards[1].rank.index + 1 === cards[2].rank.index
  );
}

/**
 * Check if the given sets of card has sequence of A23
 * @param {Array<Card>} cards
 * @returns {Boolean}
 */
function checkAceTwoThreeSequence(cards) {
  // not checking color because the sequence is checked only after checking pure sequence
  // again checking color would be repetitive
  return (
    cards[0].rank === Rank.Ace && 
    cards[1].rank === Rank.Two && 
    cards[2].rank === Rank.Three
  );
}

/**
 * Check if colors the colors of all cards are same which are of random numbers.
 * AQK should also be checked here because their numbers are Random '0', '11', '12'
 * @param {Array<Card>} cards 
 * @returns {Boolean} returns true if all the cards has same color
 */
function checkColor(cards) {
  return (
    cards[0].suits === cards[1].suits &&
    cards[1].suits === cards[2].suits
  );
}

/**
 * checks of the cards contains pairs of card
 * @param {Array<Card>} cards 
 * @returns {Boolean} - Returns true if cards contains pair
 */
function checkPair(cards) {
  return (
    cards[0].rank === cards[1].rank || 
    cards[1].rank === cards[2].rank
  );
}

/**
 * Check the units(point) from TeenPattiHandRanking by comparing each card.
 * Example: HandRankA = A and HandRankB = 2 one then 1 point is added to HandRankA and this process repeats of all 3 cards
 * @param {Array<TeenPattiHandRanking>} handRanks 
 * @returns { TeenPattiHandRanking | null } Returns null, if game drawed and if there is clear winner, returns winner TeenPattiHandRanking
 */
function checkCardUnit(handRanks) {
  /** @type {String | null} The result of the map wether it is draw or finished. Null if we have winner or 'draw' if we have no winner  */
  let matchResult = null;

  /** @type {TeenPattiHandRanking} */
  let temporaryHandRank = handRanks[0];

  for (let index = 1; index < handRanks.length; index++) { 
    temporaryHandRank.unit = 0;
    if (temporaryHandRank.cards[0].rank === Rank.Ace && handRanks[index].cards[0].rank !== Rank.Ace) {
      // if temporary card has ace and other does not, add 1  unit to temporaryHandRank
      temporaryHandRank.unit++;
    } else if (temporaryHandRank.cards[0].rank !== Rank.Ace && handRanks[index].cards[0].rank !== Rank.Ace) {
      // if current card has ace and temporary does not, add 1  unit to current card
      handRanks[index].unit++;
    }
    if (temporaryHandRank.unit === handRanks[index].unit) {
      // starting loop from the end of card
      for (let cardIndex = 2; cardIndex >= 0; cardIndex--) {
        if (temporaryHandRank.cards[cardIndex].rank > handRanks[index].cards[cardIndex].rank) {
          // if temporary card is larger then add a unit to temporary card
          temporaryHandRank.unit++;
          break;
        } else if (temporaryHandRank.cards[handRanks].rank < handRanks[index].cards[cardIndex].rank) {
          // if current card is higher add a unit to current card
          handRanks[index].unit++;
          break;
        }
      }// end of card loop
    }
    if (temporaryHandRank.unit < handRanks[index].unit) {
      // if temporaryHandRank.unit is less then current handRank.unit then we have new winner.
      // Now override temporaryHandRank with new winner.
      // also we need to override the matchResult with null because if in previous loop if we had draw then we have to override it.
      // And if temporaryHandRank is greater than current handRank than nothing changes and 
      temporaryHandRank = handRanks[index];
      matchResult = null;
    } else if (temporaryHandRank.unit === handRanks[index].unit) {
      // if temporaryHandRank.unit is equals to handRanks.unit then its a draw
      matchResult = MatchResult.Draw;
    }
  } // End of Player HandRanking loop
  if (matchResult === MatchResult.Draw) {
    return null;
  }
  return temporaryHandRank;
}

/**
 * 
 * @param {Array<TeenPattiHandRanking>} handRanks 
 */
function sortCardUnit(handRanks) {

}
module.exports = { startMatch, joinTeenPattiRoom, checkWinner, generateGameNotification, restartDrawGame, onJoinGame, onCardShow, generateGameInfo, forwardMessage };
