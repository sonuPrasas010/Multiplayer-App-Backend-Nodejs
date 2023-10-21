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
  const { userId, io, socketId } = options;
  const user = await User.findByPk(userId, { attributes: ["cash_point", "game_point"] });
  console.log(userId);
  console.log(user.toJSON());
  return user;
}

module.exports = {
  generatePoints
}
