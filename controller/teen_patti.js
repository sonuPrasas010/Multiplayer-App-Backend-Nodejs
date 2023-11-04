const sequelize = require("../model/config/config");
const { joinTeenPattiRoom, startMatch, onJoinGame, onCardShow, generateGameInfo, forwardMessage } = require("../helpers/teen_patti");
const User = require("../model/databases/user");
const { MessageType, MatchEvent } = require("../model/enums");
const TeenPattiMatch = require("../model/databases/teen_patti_match");
const TeenPattiMatchPlayer = require("../model/databases/teen_patti_match_player");
const { Model } = require("sequelize");
const socketAuth = require("../middleware/socket_auth");

// room message are those events that are sent on behalf of room like joining room
// action me
/**
 * 
 * @param {import("socket.io").Server} io 
 * @returns 
 */
const teenPattiGameSocket = (io) => {
  io.use((socket, next) => {
    socketAuth(socket, next);
  });
  io.on("connect", async (socket) => {
    const userId = socket.userId;

    /** @type {number | null } Id of currently playing match */
    let teenPattiMatchId = null;

    /** @type {number|null} Current user Id */
    let teenPattiMatchPlayerId = null;
    // console.log(userId);
    try {
    // join room and get joined room, and match player id
      const [teenPattiMatch, teenPattiMatchPlayer] = await jonRoom(userId, socket.id);
      teenPattiMatchId = teenPattiMatch.id;
      teenPattiMatchPlayerId = teenPattiMatchPlayer.getDataValue("id");
      await socket.join(teenPattiMatchId);
      socket.emit("action", {
        navigateTo: "game",
        match: teenPattiMatchPlayer
      });
      const user = await User.findByPk(userId);
      const message = generateGameNotification({ message: "joined the room", user, job: "append" });
      io.to(teenPattiMatchId).emit(MatchEvent.RoomMessage, message);
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

    socket.on(MatchEvent.Show, async() => {
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
        const [user, teenPattiMatchPlayer, teenPattiMatch] = await Promise.all([
          User.findByPk(userId),
          TeenPattiMatchPlayer.findByPk(teenPattiMatchPlayerId),
          TeenPattiMatch.findByPk(teenPattiMatchId)
        ]);

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

/**
 * This function allows a user to join a Teen Patti room.
 *
 * @param {number} userId - The unique identifier of the user.
 * @param {string} socketId - The unique identifier of the socket connection.
 *
 * @returns {Promise<Array<Model>>} An array containing two elements. The first element is the TeenPattiMatch object, 
 *                  and the second element is the TeenPattiMatchPlayer object.
 *
 * The function works as follows:
 * 1. It first tries to find a Teen Patti match where the player count is less than or equal to 20.
 * 2. If such a match is found, it allows the user to join this room by calling the `joinTeenPattiRoom` function.
 * 3. If no such match is found, it creates a new Teen Patti match and allows the user to join this new room.
 *
 * Note: The `joinTeenPattiRoom` function should be defined elsewhere in your code and should handle 
 *       the logic of adding a user to a Teen Patti room.
 */
async function jonRoom(userId, socketId) {
  /** 
   * @type {Array<Model>}
   * This holds the data of Teen Patti Match and Teen Patti Match Player. This will be returned after the completion of function.
   */
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
  if (teenPattiMatch) {
    const teenPattiMatchPlayer = await joinTeenPattiRoom(
      teenPattiMatch.id,
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
/**
 * 
 * @param {Model} teenPattiMatchPlayer 
 * @returns 
 */
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
  if (teenPattiMatch.getDataValue("playerCount") > 0) return;
  teenPattiMatch.set("isBotActive", false);
  teenPattiMatch.set("gameStatus", "ideal");
  teenPattiMatch.set("prize", 0)
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
