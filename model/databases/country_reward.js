const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");

/**
 * Represents a country reward in the database.
 *
 * @typedef {Object} CountryReward
 * @property {string} country_name - The name of the country.
 * @property {string} country_code - The code of the country.
 * @property {number} reward - The reward associated with the country.
 */
const CountryReward = sequelize.define("country_reward", {
  /**
   * The name of the country.
   *
   * @type {string}
   */
  country_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  /**
   * The code of the country.
   *
   * @type {string}
   */
  country_code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  /**
   * The reward associated with the country.
   *
   * @type {number}
   */
  reward: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

module.exports = CountryReward;
