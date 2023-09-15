const { Socket, Server } = require("socket.io");
// const {
//   LowCardMatchPlayer,
//   LowCardMatch,
//   LowCardMessages
// } = require("../model/config/relations");

const { MessageType, MatchResult, GameStatus, MatchEvent, Rank, HandRanking } = require("../model/enums");
const User = require("../model/databases/user");
const sequelize = require("../model/config/config");
const { shuffleArray } = require("./shuffle");
const TeenPattiMatch = require("../model/databases/teen_patti_match");
const TeenPattiMatchPlayer = require("../model/databases/teen_patti_match_player");
const TeenPattiMatchMessages = require("../model/databases/teen_patti_match_messages");
const TeenPattiHandRanking = require("../model/teen_patti_hand_ranking");
const Card = require("../model/card");

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
    where: { id: teenPattiMatchPlayerId },
    include: { model: TeenPattiMatch, where: { gameStatus: "playing" } } 
  });

  console.log(matchPlayer.toJSON());

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

async function startMatch ({
  socket = new Socket(),
  io = new Server(),
  matchId
}) { 
  if (!(await checkOrChangeMatchAvability(matchId))) {
    return;
  }
      
  io.to(matchId).emit("gameStatus", "starting");

  const message = generateGameNotification({ message: "game has started" });
  io.to(matchId).emit("roomMessage", message);

  console.log("update low card match status to join");
  // const count = await LowCardMatch.update({ gameStatus: "joining" }, { where: { id: matchId } });
  // console.log(count[0]);
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
        console.log("hello match player");
        let playerPoint = matchPlayer.user.play_point;
        playerPoint += 10;
        console.log(playerPoint);
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
      // in this time they can thow their card or eliminated. but this feature is not implemented yet
      await TeenPattiMatch.update({ gameStatus: "waiting" }, { where: { id: matchId } })
      io.to(matchId).emit("gameStatus", "waiting");
      const message = generateGameNotification({
        message: "Checking winner. Please wait!",
        messageType: MessageType.BotInfo
      });
      io.to(matchId).emit("roomMessage", message);
      const passiveUsers = await eliminatePassiveUser({ io, socket, lowCardMatchId: matchId });

      const result = await checkWinner(socket, io, matchId);
      if (result === MatchResult.Draw) {
        await restartDrawGame({ socket, io, matchId });
        return;
      }
      if (result === MatchResult.NextRound) {
        // 
      }
    }, 15000);
  }, 15000);
}

async function joinTeenPattiRoom (matchId = 0, userId, socketId) {
  console.log(`socket_id: ${socketId}`);
  const teenPattiMatchPlayer = TeenPattiMatchPlayer.create({ match_id: matchId, user_id: userId, socket_id: socketId });
  return await teenPattiMatchPlayer;
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
 * @returns {MatchResult}
 */
async function checkWinner (socket, io, matchId) {
  /** @type {Array<TeenPattiHandRanking>} */
  const handRanking = [];
  
  // finding count and user user playing in provided match
  let { rows, count } = await TeenPattiMatchPlayer.findAndCountAll({
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
  
  for (let index = 0; index < rows.length; index++) {
    const cardsJson = JSON.parse(rows[index].teen_patti_match_messages.card);
    /** @type {Array<Card>} -This is the list of Decoded card model after querying from the database */
    const cards = [];
    for (const card of cardsJson) {
      cards.push(new Card(card.rank, card.suit))
    }
    if (checkTrial(cards)) {
      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.Trail, 0);
      handRanking.push(teenPattiHandRanking);
    } else if (checkPureSequence(cards)) {
      // we are not checking AQK Pure sequence here to save cpu cycle
      // we will check that while matching color as it helps to save cpu cycle
      if (checkAceTwoThreePureSequence(cards)) {
        const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.AceTwoThreePureSequence, 0);
        handRanking.push(teenPattiHandRanking);
        continue;
      } 
      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.PureSequence, 0);
      handRanking.push(teenPattiHandRanking);
    } else if (checkSequence(cards)) {
      if (checkAceTwoThreeSequence(cards)) {
        const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.AceTwoThreeSequence, 0);
        handRanking.push(teenPattiHandRanking);
        continue;
      }
      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.Sequence, 0);
      handRanking.push(teenPattiHandRanking);
    } else if (checkColor(cards)) {
      if (checkAceQueenKingPureSequence(cards)) {
        // checking 0, 11 ,12 pure sequence here because it is not sequence asn 123 or 456
        // so checking here and random cards also falls down here
        const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.AceQueenKingPureSequence, 0);
        handRanking.push(teenPattiHandRanking);
        continue;
      }
      const teenPattiHandRanking = new TeenPattiHandRanking(HandRanking.AceQueenKingPureSequence, 0);
      handRanking.push(teenPattiHandRanking);
      continue;
    } else if (checkPair(cards)) {

    }
  }
  
  rows = rows.sort((a, b) => {
    const rankA = JSON.parse(a.teen_patti_match_message.card).rank;
    const rankB = JSON.parse(b.teen_patti_match_message.card).rank;
  
    if (rankA === 0) {
      return -1; // Move rank 0 to the beginning (highest value)
    } else if (rankB === 0) {
      return 1; // Move rank 0 to the beginning (highest value)
    } else {
      // Compare ranks normally for other values
      return rankB - rankA;
    }
  });
  
  if (count <= 5) {
    // sort it in ascending order and highest number wins if draws then restart the game
    return await chooseWinner({ totalUser: count, matchId, io, matchPlayer: rows });
  }
  const reminder = count % 5;

  if (reminder === 0) {
    // if reminder is zero then eliminate 5 user
    return await eliminateUser({ user: rows });
  }
  // if reminder is not zero then eliminate reminder's count of user
  return await eliminateUser({ numberOfUser: reminder, users: rows });
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

// this is the private function 
async function eliminateUser({ numberOfUser = 5, users = [], io = new Server() }) {
  for (let index = 0; index < numberOfUser; index++) {
    users[index].setDataValue("is_playing", false);
    await users[index].save();
    const message = generateGameNotification({
      job: "append",
      message: "have been eliminated"
    });
    io.to(users[index].getDataValue("socket_id")).emit("roomMessage", message);
    io.to(users[index].getDataValue("socket_id")).emit("amIActive", false);
  }
  return MatchResult.NextRound;
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
  const cards = shuffleArray();

  await TeenPattiMatchMessages.destroy({
    where: {
      match_id: matchId
    }
  })
  const drawedPlayers = await TeenPattiMatchPlayer.findAll({
    where: {
      match_id: matchId,
      isPlaying: true
    },
    include: User
  }
  );
  
  const playerCards = [];
  for (const key in drawedPlayers) {
    const data = {};
    data.card = cards[key];
    data.user_id = drawedPlayers[key].getDataValue("user_id");
    data.match_id = drawedPlayers[key].getDataValue("match_id"); 
    data.match_player_id = drawedPlayers[key].getDataValue("id");
    playerCards.push(data);

    const message = generateGameNotification({
      card: data.card,
      messageType: MessageType.CardShow,
      user: {
        name: drawedPlayers[key].user.name,
        id: drawedPlayers[key].user.id
      }
    });
    io.to(drawedPlayers[key].getDataValue("socket_id")).emit("roomMessage", message)
  }

  await TeenPattiMatchMessages.bulkCreate(playerCards);
 
  await TeenPattiMatch.update({ gameStatus: "playing" },
    {
      where: {
        id: matchId
      }
    });

  io.to(matchId).emit("startTime", new Date());
  io.to(matchId).emit("gameStatus", "playing")

  setTimeout(async() => {
    const matchResult = await checkWinner(socket, io, matchId);
    if (matchResult === MatchResult.Draw) {
      restartDrawGame(socket, io, matchId);
    }
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

async function shuffleAndDistributeCard({
  io = new Server(),
  socket = new Socket(),
  teenPattiMatchId
}) {
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
  for (let index = 0; index < joinedPlayers.length; index++) {
    const data = {};
    const cards = [];

    for (let index = 0; index < 3; index++) {
      const randomIndex = Math.floor(Math.random() * shuffledCard.length);
      console.log(shuffledCard[index]);
      console.log(index);
      cards.push(shuffledCard[index].toJson());
      shuffledCard.splice(randomIndex);
    }
    console.log(shuffledCard); 
    // data.card = shuffledCard[index].toJson();
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

  console.log(matchPlayer.toJSON());

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
 * check if the given sets of card has pure sequence of A23.
 * Example A♥2♥3♥
 * @param {Array<Card>} cards
 * @returns {Boolean}
 */
function checkAceQueenKingPureSequence(cards) {
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
    cards[0].suit === cards[1].suit &&
    cards[1].suit === cards[2].suit
  );
}

function checkPair(cards) {

}
module.exports = { startMatch, joinTeenPattiRoom, checkWinner, generateGameNotification, restartDrawGame, onJoinGame, onCardShow, generateGameInfo };
