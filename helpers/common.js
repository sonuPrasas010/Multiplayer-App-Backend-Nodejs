const User = require("../model/databases/user");
const { MatchEvent } = require("../model/enums");

/**
 * 
 * @param {Object} options 
 * @param {number} options.userId 
 * @param {import('socket.io').Server} options.io
 * @param {String} options.socketId
 */
async function generatePoints(options) {
  const { userID, io, socketId } = options;
  const user = await User.findByPk(userID, { attributes: ["cash_point", "game_point"] });
  return user;
  io.to(socketId).emit(MatchEvent.Points, user.toJSON());
}

module.exports = {
  generatePoints
}
