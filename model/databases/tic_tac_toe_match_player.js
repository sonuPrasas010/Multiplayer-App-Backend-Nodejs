const { DataTypes } = require("sequelize");
const User = require("./user");
const TicTacToeMatch = require("./tic_tac_toe_match");
const sequelize = require("../config/config");

const TicTacToeMatchPlayer = sequelize.define("tic_tac_toe_match_player", {
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
    references: TicTacToeMatch.id
  },
  socket_id: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, 
{
  sequelize,
  indexes: [
    {
      unique: true,
      fields: ["match_id", "user_id"]
    }
  ]
}
);

module.exports = TicTacToeMatchPlayer;
