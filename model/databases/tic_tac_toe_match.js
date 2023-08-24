const { DataTypes } = require("sequelize");
const User = require("./user");
const sequelize = require("../config/config");

const TicTacToeMatch = sequelize.define("tic_tac_toe_match", {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true
  },
  game_status: {
    allowNull: false,
    defaultValue: "ideal",
    type: DataTypes.ENUM([
      "ideal",
      "starting",
      "joining",
      "playing",
      "waiting",
      "checking"
    ])
  },
  isBotActive: {
    allowNull: false,
    defaultValue: false,
    type: DataTypes.BOOLEAN
  },
  prize: {
    allowNull: false,
    defaultValue: 0,
    type: DataTypes.SMALLINT.UNSIGNED
  },
  round: {
    allowNull: false,
    defaultValue: 1,
    type: DataTypes.TINYINT.UNSIGNED
  },
  
  turn: {
    allowNull: true,
    type: DataTypes.BIGINT.UNSIGNED,
    references: User.id
  }
},
{ sequelize });

module.exports = TicTacToeMatch;
