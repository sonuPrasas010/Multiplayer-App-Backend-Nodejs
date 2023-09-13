const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");
const User = require("./user");
const TeenPattiMatch = require("./teen_patti_match");
const TeenPattiMatchPlayer = require("./teen_patti_match_player");

const TeenPattiMatchMessages = sequelize.define("teen_patti_match_messages", {
  message: {
    type: DataTypes.STRING
  },
  card: {
    type: DataTypes.JSON
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: User.id
  },
  match_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: TeenPattiMatch.id
  },
  match_player_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: TeenPattiMatchPlayer.id
  }
});

module.exports = TeenPattiMatchMessages;
