const { request, response } = require("express");
const LowCardMatch = require("../model/databases/low_card_match");
const sequelize = require("../model/config/config");
const { joinLowCardRoom, startMatch, onJoinGame, onCardShow, generateGameInfo } = require("../helpers/low_card");

// eslint-disable-next-line no-unused-vars
const { Server, Socket } = require("socket.io");
const User = require("../model/databases/user");
const { MessageType, MatchEvent, GameStatus } = require("../model/enums");
const LowCardMatchPlayer = require("../model/databases/low_card_match_player");
const socketAuth = require("../middleware/socket_auth");
const { generatePoints } = require("../helpers/common");

// room message are those events that are sent on behalf of room like joining room
// action me

const makeMatch = async (req = request, res = response) => {
  let lowCardMatch = await LowCardMatch.findOne({
    attributes: {
      include: [
        [
          sequelize.literal(
            "(Select COUNT(*) FROM low_card_match_players WHERE low_card_match_players.match_id = low_card_match.id)"
          ),
          "playerCount"
        ]
      ]
    },
    having: sequelize.literal("playerCount <= 20")
  });

  if (lowCardMatch) {
    const room = await joinLowCardRoom(lowCardMatch.getDataValue("id"), 1);
    res.json(room);
  } else {
    lowCardMatch = await LowCardMatch.create();
    const room = await joinLowCardRoom(lowCardMatch.getDataValue("id"), 1);
    res.json(room);
  }
};

/**
 * 
 * @param {Server} io 
 * @returns 
 */
const lowCardGameSocket = (io) => {
  io.use((socket, next) => {
    socketAuth(socket, next);
  });
  io.on("connect", async (socket) => {
    const userId = socket.userId;
    let lowCardMatchId = null;
    let lowCardMatchPlayerId = null;
    // console.log(userId);
    try {
    // join room and get joined room, and match player id
      const [lowCardMatch, lowCardMatchPlayer] = await jonRoom(userId, socket.id);
      lowCardMatchId = lowCardMatch.getDataValue("id");
      lowCardMatchPlayerId = lowCardMatchPlayer.getDataValue("id");
      await socket.join(lowCardMatchId);

      socket.emit("action", {
        navigateTo: "game",
        match: lowCardMatchPlayer
      });
      const user = await User.findByPk(userId);
      const message = generateGameNotification({
        message: "joined the room",
        user,
        job: "append"
      });
      io.to(lowCardMatch.getDataValue("id")).emit("roomMessage", message);
      socket.emit("amIActive", false);// when the user joins for the first time he is always act
      socket.emit("gameStatus", lowCardMatch.getDataValue("gameStatus"));
      io.to(lowCardMatchId).emit(MatchEvent.GameInfo, await generateGameInfo(lowCardMatchId));
    } catch (e) {
      console.log(e);
      // socket.disconnect();
    }

    socket.on("startMatch", async () => {
      try {
        await startMatch({
          socket,
          io,
          matchId: lowCardMatchId
        });
      } catch (error) {
        console.log(error);
      }
    });
    
    socket.on("joinMatch", async () => {
      try {
        await onJoinGame({ socket, io, matchId: lowCardMatchId, userId });
        socket.emit(MatchEvent.Points, await generatePoints({ userId }))
        io.to(lowCardMatchId).emit(MatchEvent.GameInfo, await generateGameInfo(lowCardMatchId));
      } catch (error) {
        console.log(error);
      }
    });

    socket.on("show", async() => {
      await onCardShow({ socket, io, userId, matchId: lowCardMatchId, lowCardMatchPlayerId });
      io.to(lowCardMatchId).emit(MatchEvent.GameInfo, await generateGameInfo(lowCardMatchId));
    });
    // on socket disconnected
    socket.on("disconnect", async () => {
      try {
        console.log("disconnected");
        const user = await User.findByPk(userId);
        const lowCardMatchPlayer = await LowCardMatchPlayer.findByPk(lowCardMatchPlayerId);
        const lowCardMatch = await LowCardMatch.findByPk(lowCardMatchId);
        const message = generateGameNotification({
          message: "left the group",
          user,
          messageType: MessageType.BotDanger,
          job: "append"
        });
        io.to(lowCardMatchId).emit(MatchEvent, message);
        io.to(lowCardMatchId).emit(MatchEvent.GameInfo, await generateGameInfo(lowCardMatchId));
        await leaveRoom(lowCardMatchPlayer, lowCardMatch.id);
      } catch (error) {
        console.log(error);
      }
    });    
  });

  return io;
};

module.exports = {
  makeMatch,
  lowCardGameSocket
};

async function jonRoom(userId, socketId) {
  let data = [];
  // find match where user count is less than 21
  let lowCardMatch = await LowCardMatch.findOne({
    attributes: {
      include: [
        [
          sequelize.literal(
            "(Select COUNT(*) FROM low_card_match_players WHERE low_card_match_players.match_id = low_card_match.id)"
          ),
          "playerCount"
        ]
      ]
    },
    having: sequelize.literal("playerCount <= 20")
  });
  console.log(`Join room socket id: ${socketId}`);
  if (lowCardMatch) {
    const lowCardMatchPlayer = await joinLowCardRoom(
      lowCardMatch.getDataValue("id"),
      userId, 
      socketId
    );
    data = [lowCardMatch, lowCardMatchPlayer];
  } else {
    lowCardMatch = await LowCardMatch.create();
    const lowCardMatchPlayer = await joinLowCardRoom(
      lowCardMatch.getDataValue("id"),
      userId,
      socketId
    );
    data = [lowCardMatch, lowCardMatchPlayer];
  }

  return data;
}

async function leaveRoom(lowCardMatchPlayer) {
  // delete player match
  await lowCardMatchPlayer.destroy();

  const lowCardMatch = await LowCardMatch.findByPk(
    lowCardMatchPlayer.getDataValue("match_id"),
    {
      attributes: {
        include: [
          [
            sequelize.literal(
              "(Select COUNT(*) FROM low_card_match_players WHERE low_card_match_players.match_id = low_card_match.id)"
            ),
            "playerCount"
          ]
        ]
      }
    }
  );
  // if low card makeMatch has 0 player then formatting its attributes
  if (lowCardMatch.getDataValue("playerCount") > 0) return;
  lowCardMatch.set("isBotActive", false);
  lowCardMatch.set("gameStatus", GameStatus.Ideal);
  lowCardMatch.set("round", 1);
  await lowCardMatch.save();
}

function generateGameNotification({
  message,
  sentBy = "bot",
  messageType = MessageType.BotSuccess,
  card,
  user = {
    name: "bot",
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
