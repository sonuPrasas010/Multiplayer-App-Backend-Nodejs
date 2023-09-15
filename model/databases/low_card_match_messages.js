const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");
const LowCardMatchPlayer = require("./low_card_match_player");
const User = require("./user");
const LowCardMatch = require("./low_card_match");

const LowCardMessages = sequelize.define("low_card_match_messages", {
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
    references: LowCardMatch.id
  },
  match_player_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: LowCardMatchPlayer.id
  }
});

module.exports = LowCardMessages;
