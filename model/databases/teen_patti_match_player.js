const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");
const User = require("./user");
const TeenPattiMatch = require("./teen_patti_match");

const TeenPattiMatchPlayer = sequelize.define("teen_patti_match_player", {
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
    references: TeenPattiMatch.id
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

module.exports = TeenPattiMatchPlayer;
