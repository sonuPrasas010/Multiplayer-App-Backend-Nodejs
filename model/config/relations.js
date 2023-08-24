const LowCardMatch = require("../databases/low_card_match")
const LowCardMatchPlayer = require("../databases/low_card_match_player");
const User = require("../databases/user");
const LowCardMessages = require("../databases/low_card_match_messages");
const TicTacToeMatchPlayer = require("../databases/tic_tac_toe_match_player");
const TicTacToeMoves = require("../databases/tic_tac_toe_moves");
const TicTacToeMatch = require("../databases/tic_tac_toe_match");

LowCardMatchPlayer.belongsTo(User, { foreignKey: "user_id" })
User.hasMany(LowCardMatchPlayer, { foreignKey: "user_id" });

LowCardMatchPlayer.belongsTo(LowCardMatch, { foreignKey: "match_id" })
LowCardMatch.hasMany(LowCardMatchPlayer, { foreignKey: "match_id" });

LowCardMessages.belongsTo(LowCardMatchPlayer, { foreignKey: "match_player_id", onDelete: "CASCADE" });
LowCardMatchPlayer.hasOne(LowCardMessages, { foreignKey: "match_player_id", onDelete: "CASCADE" })

LowCardMessages.belongsTo(LowCardMatch, { foreignKey: "match_id" });
LowCardMessages.belongsTo(User, { foreignKey: "user_id" });

User.hasMany(LowCardMessages, { foreignKey: "user_id" });
LowCardMatch.hasMany(LowCardMessages, { foreignKey: "match_id" });

User.hasOne(TicTacToeMatchPlayer, { foreignKey: "user_id" });
TicTacToeMatchPlayer.belongsTo(User, { foreignKey: "user_id" });
TicTacToeMatch.hasMany(TicTacToeMatchPlayer, { foreignKey: "match_id", onDelete: "CASCADE" });
TicTacToeMatchPlayer.belongsTo(TicTacToeMatch, { foreignKey: "match_id", onDelete: "CASCADE" })

TicTacToeMatchPlayer.hasMany(TicTacToeMoves, { foreignKey: "match_player_id", onDelete: "CASCADE" });
TicTacToeMoves.belongsTo(TicTacToeMatchPlayer, { foreignKey: "match_player_id", onDelete: "CASCADE" });

// module.exports = {
//   User,
//   LowCardMessages,
//   LowCardMatchPlayer,
//   LowCardMatch
// }
