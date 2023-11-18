/**
 * @module TicTacToeMatch
 * @requires sequelize
 * @requires user
 * @requires config/config
 */

const { DataTypes, Model } = require("sequelize");
const User = require("./user");
const sequelize = require("../config/config");

/**
 * @classdesc TicTacToeMatch is a model representing a table in the database.
 * It represents the matches in a game of Tic Tac Toe.
 * @class
 * @augments Model
 * 
 * The properties in the `TicTacToeMatch` class are:

- **id**: The primary key of the table, auto-incremented.
- **game_status**: The status of the game. It is an ENUM and can take values from "ideal", "starting", "joining", "playing", "waiting", "checking". It cannot be null and defaults to "ideal".
- **isBotActive**: A boolean indicating whether the bot is active. It cannot be null and defaults to false.
- **prize**: The prize for the match. It is an unsigned SMALLINT, cannot be null, and defaults to 0 if not provided.
- **round**: The current round of the match. It is an unsigned TINYINT, cannot be null, and defaults to 1 if not provided.
- **turn**: The ID of the user whose turn it is. It references the User model.
 */
const TicTacToeMatch = sequelize.define("tic_tac_toe_match", {
  /**
   * @property {DataTypes.BIGINT.UNSIGNED} id - The primary key of the table, auto-incremented.
   */
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true
  },
  /**
   * @property {DataTypes.ENUM} game_status - The status of the game. It is an ENUM and can take values from "ideal", "starting", "joining", "playing", "waiting", "checking". It cannot be null and defaults to "ideal".
   */
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
  /**
   * @property {DataTypes.BOOLEAN} isBotActive - A boolean indicating whether the bot is active. It cannot be null and defaults to false.
   */
  isBotActive: {
    allowNull: false,
    defaultValue: false,
    type: DataTypes.BOOLEAN
  },
  /**
   * @property {DataTypes.SMALLINT.UNSIGNED} prize - The prize for the match. It is an unsigned SMALLINT, cannot be null, and defaults to 0 if not provided.
   */
  prize: {
    allowNull: false,
    defaultValue: 0,
    type: DataTypes.SMALLINT.UNSIGNED
  },
  /**
   * @property {DataTypes.TINYINT.UNSIGNED} round - The current round of the match. It is an unsigned TINYINT, cannot be null, and defaults to 1 if not provided.
   */
  round: {
    allowNull: false,
    defaultValue: 1,
    type: DataTypes.TINYINT.UNSIGNED
  },
  
  /**
   * @property {DataTypes.BIGINT.UNSIGNED} turn - The ID of the user whose turn it is. It references the User model.
   */
  turn: {
    allowNull: true,
    type: DataTypes.BIGINT.UNSIGNED,
    references: User.id
  },

  move_id: {
    allowNull: true,
    type: DataTypes.STRING
  }
},
{ sequelize });

module.exports = TicTacToeMatch;
