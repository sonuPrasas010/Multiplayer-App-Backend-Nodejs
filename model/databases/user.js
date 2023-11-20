/**
 * @module User
 * @requires sequelize
 * @requires config/config
 */

const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");

/**
 * @classdesc User is a model representing a table in the database.
 * It represents the users in a game.
 * @class
 * @augments Model
 * 
 * The properties in the `User` class are:

- **id**: The primary key of the table, auto-incremented.
- **name**: The name of the user. It is a string and cannot be null.
- **email**: The email of the user. It is a string, cannot be null, and must be unique.
- **image**: The image of the user. It is a string and can be null.
- **cash_point**: The cash points of the user. It is an unsigned integer, cannot be null, and defaults to 0 if not provided.
- **game_point**: The game points of the user. It is an unsigned integer, cannot be null, and defaults to 0 if not provided.
 */
const User = sequelize.define("user", {
  /**
   * @property {DataTypes.BIGINT.UNSIGNED} id - The primary key of the table, auto-incremented.
   */
  id: {
    primaryKey: true,
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true
  },
  /**
   * @property {DataTypes.STRING} name - The name of the user. It is a string and cannot be null.
   */
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  /**
   * @property {DataTypes.STRING} email - The email of the user. It is a string, cannot be null, and must be unique.
   */
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  /**
   * @property {DataTypes.STRING} image - The image of the user. It is a string and can be null.
   */
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  /**
   * @property {DataTypes.INTEGER.UNSIGNED} cash_point - The cash points of the user. It is an unsigned integer, cannot be null, and defaults to 0 if not provided.
   */
  cash_point: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    allowNull: false
  },
  /**
   * @property {DataTypes.INTEGER.UNSIGNED} game_point - The game points of the user. It is an unsigned integer, cannot be null, and defaults to 0 if not provided.
   */
  game_point: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    allowNull: false
  }
});

module.exports = User;
