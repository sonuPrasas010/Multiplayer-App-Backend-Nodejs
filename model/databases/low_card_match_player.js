const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");
const User = require("./user");
const LowCardMatch = require("./low_card_match");

const LowCardMatchPlayer = sequelize.define("low_card_match_player", {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
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
  is_playing: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  shown: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  socket_id: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, 
{
  indexes: [
    {
      unique: true,
      fields: ["match_id", "user_id"]
    }
  ]
});

module.exports = LowCardMatchPlayer;
