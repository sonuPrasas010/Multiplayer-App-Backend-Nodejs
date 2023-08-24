const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");

const CountryReward = sequelize.define("country_reward", {
  country_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  country_code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  reward: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

module.exports = CountryReward;
