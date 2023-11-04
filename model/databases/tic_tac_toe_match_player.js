/**
 * @module TicTacToeMatchPlayer
 * @requires sequelize
 * @requires user
 * @requires tic_tac_toe_match
 * @requires config/config
 */

const { DataTypes } = require("sequelize");
const User = require("./user");
const TicTacToeMatch = require("./tic_tac_toe_match");
const sequelize = require("../config/config");

/**
 * @classdesc TicTacToeMatchPlayer is a model representing a table in the database.
 * It represents the players who participate in a game of Tic Tac Toe.
 * @class
 * @augments Model
 * 
 * The properties in the `TicTacToeMatchPlayer` class are:

- **id**: The primary key of the table, auto-incremented.
- **user_id**: The foreign key referencing the User model. It cannot be null.
- **match_id**: The foreign key referencing the TicTacToeMatch model. It cannot be null.
- **socket_id**: The ID of the socket associated with the player. It cannot be null.
- **bet**: The bet placed by the player. It is an integer, cannot be null, and defaults to 0 if not provided.
 */
const TicTacToeMatchPlayer = sequelize.define("tic_tac_toe_match_player", {
  /**
   * @property {DataTypes.BIGINT.UNSIGNED} id - The primary key of the table, auto-incremented.
   */
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  /**
   * @property {DataTypes.BIGINT.UNSIGNED} user_id - The foreign key referencing the User model. It cannot be null.
   */
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: User.id
  },
  /**
   * @property {DataTypes.BIGINT.UNSIGNED} match_id - The foreign key referencing the TicTacToeMatch model. It cannot be null.
   */
  match_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: TicTacToeMatch.id
  },
  /**
   * @property {DataTypes.STRING} socket_id - The ID of the socket associated with the player. It cannot be null.
   */
  socket_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  /**
   * @property {DataTypes.INTEGER} bet - The bet placed by the player. It is an integer, cannot be null, and defaults to 0 if not provided.
   */
  bet: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
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
