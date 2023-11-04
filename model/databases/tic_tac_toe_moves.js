/**
 * @module TicTacToeMoves
 * @requires sequelize
 * @requires config/config
 */

const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/config");

/**
 * @classdesc TicTacToeMoves is a model representing a table in the database.
 * It represents the moves made by players in a game of Tic Tac Toe.
 * @class
 * @augments Model
 * 
 * The properties in the `TicTacToeMoves` class are:

- **id**: The primary key of the table, auto-incremented.
- **match_player_id**: The ID of the player who made the move. It cannot be null.
- **move**: The move made by the player. It is represented as an ENUM and can take values from 0 to 8. It cannot be null.
 */
const TicTacToeMoves = sequelize.define("tic_tac_toe_moves", {
  /**
   * @property {DataTypes.BIGINT.UNSIGNED} id - The primary key of the table, auto-incremented.
   */
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  /**
   * @property {DataTypes.BIGINT.UNSIGNED} match_player_id - The ID of the player who made the move. It cannot be null.
   */
  match_player_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  /**
   * @property {DataTypes.ENUM} move - The move made by the player. It is represented as an ENUM and can take values from 0 to 8. It cannot be null.
   */
  move: {
    type: DataTypes.ENUM("0", "1", "2", "3", "4", "5", "6", "7", "8"),
    allowNull: false
  }
},

{ sequelize });

module.exports = TicTacToeMoves;
