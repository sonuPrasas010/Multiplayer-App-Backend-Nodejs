const sequelize = require("../model/config/config");
const { joinTeenPattiRoom, startMatch, onJoinGame, onCardShow, generateGameInfo, forwardMessage } = require("../helpers/teen_patti");
const { Server } = require("socket.io");
const User = require("../model/databases/user");
const { MessageType, MatchEvent } = require("../model/enums");
const TeenPattiMatch = require("../model/databases/teen_patti_match");
const TeenPattiMatchPlayer = require("../model/databases/teen_patti_match_player");

// room message are those events that are sent on behalf of room like joining room
// action me

const teenPattiGameSocket = (io = new Server()) => {
  io.on("connect", async (socket) => {
    const userId = socket.handshake.query.user_id;

    /** @type {number | null } Id of currently playing match */
    let teenPattiMatchId = null;

    /** @type {number|null} Current user Id */
    let teenPattiMatchPlayerId = null;
    // console.log(userId);
    try {
    // join room and get joined room, and match player id
      const [teenPattiMatch, teenPattiMatchPlayer] = await jonRoom(userId, socket.id);
      teenPattiMatchId = teenPattiMatch.getDataValue("id");
      teenPattiMatchPlayerId = teenPattiMatchPlayer.getDataValue("id");
      await socket.join(teenPattiMatchId);
      socket.emit("action", {
        navigateTo: "game",
        match: teenPattiMatchPlayer
      });
      const user = await User.findByPk(userId);
      const message = generateGameNotification({ message: "joined the room", user, job: "append" });
      io.to(teenPattiMatch.getDataValue("id")).emit("roomMessage", message);
      socket.emit("amIActive", false);// when the user joins for the first time he is always act
      socket.emit("gameStatus", teenPattiMatch.getDataValue("gameStatus"));
      io.to(teenPattiMatchId).emit(MatchEvent.GameInfo, await generateGameInfo(teenPattiMatchId));
    } catch (e) {
      console.log(e);
      socket.disconnect();
    }

    socket.on("startMatch", async () => {
      startMatch({
        socket,
        io,
        matchId: teenPattiMatchId
      });
    });

    socket.on("joinMatch", async () => {
      await onJoinGame({ socket, io, matchId: teenPattiMatchId, userId });
      io.to(teenPattiMatchId).emit(MatchEvent.GameInfo, await generateGameInfo(teenPattiMatchId));
    });

    socket.on("show", async() => {
      await onCardShow({ socket, io, userId, matchId: teenPattiMatchId, teenPattiMatchPlayerId });
      io.to(teenPattiMatchId).emit(MatchEvent.GameInfo, await generateGameInfo(teenPattiMatchId));
    });
     
    socket.on(MatchEvent.ClientMessage, (message) => {
      console.log(message);
      forwardMessage(socket, io, message, userId, teenPattiMatchId);
    })
    // on socket disconnected
    socket.on("disconnect", async () => {
      try {
        console.log("disconnected");
        const user = User.findByPk(userId);
        const teenPattiMatchPlayer = await TeenPattiMatchPlayer.findByPk(teenPattiMatchPlayerId);
        const teenPattiMatch = await TeenPattiMatch.findByPk(teenPattiMatchId);

        console.log(teenPattiMatch);
        await leaveRoom(teenPattiMatchPlayer, teenPattiMatch.id);
        const message = generateGameNotification({
          message: "Left the group",
          user,
          messageType: MessageType.BotDanger,
          job: "append"
        });
        socket.to(teenPattiMatchId).emit("roomMessage", message);
        io.to(teenPattiMatchId).emit(MatchEvent.GameInfo, await generateGameInfo(teenPattiMatchId));
      } catch (error) {
        console.log(error);
      }
    });    
  });

  return io;
};

module.exports = {
  teenPattiGameSocket
};

async function jonRoom(userId, socketId) {
  let data = [];
  // find match where user count is less than 21
  let teenPattiMatch = await TeenPattiMatch.findOne({
    attributes: {
      include: [
        [
          sequelize.literal(
            "(Select COUNT(*) FROM teen_patti_match_players WHERE teen_patti_match_players.match_id = teen_patti_match.id)"
          ),
          "playerCount"
        ]
      ]
    },
    having: sequelize.literal("playerCount <= 20")
  });
  console.log(`Join room socketid: ${socketId}`);
  if (teenPattiMatch) {
    const teenPattiMatchPlayer = await joinTeenPattiRoom(
      teenPattiMatch.getDataValue("id"),
      userId, 
      socketId
    );
    data = [teenPattiMatch, teenPattiMatchPlayer];
  } else {
    teenPattiMatch = await TeenPattiMatch.create();
    const lowCardMatchPlayer = await joinTeenPattiRoom(
      teenPattiMatch.id,
      userId,
      socketId
    );
    data = [teenPattiMatch, lowCardMatchPlayer];
  }

  return data;
}

async function leaveRoom(teenPattiMatchPlayer) {
  // delete player match
  await teenPattiMatchPlayer.destroy();

  const teenPattiMatch = await TeenPattiMatch.findByPk(
    teenPattiMatchPlayer.getDataValue("match_id"),
    {
      attributes: {
        include: [
          [
            sequelize.literal(
              "(Select COUNT(*) FROM teen_patti_match_players WHERE teen_patti_match_players.match_id = teen_patti_match.id)"
            ),
            "playerCount"
          ]
        ]
      }
    }
  );
  // if low card makeMatch has 0 player then formatting its attributes
  console.log(teenPattiMatch.toJSON());
  if (teenPattiMatch.getDataValue("playerCount") > 0) return;
  teenPattiMatch.set("isBotActive", false);
  teenPattiMatch.set("gameStatus", "ideal");
  await teenPattiMatch.save();
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
