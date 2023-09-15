const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/config");

const TicTacToeMoves = sequelize.define("tic_tac_toe_moves", {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  match_player_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  move: {
    type: DataTypes.ENUM("11", "12", "13", "21", "22", "23", "31", "32", "33"),
    allowNull: false
  }
},
{ sequelize });

module.exports = TicTacToeMoves;
