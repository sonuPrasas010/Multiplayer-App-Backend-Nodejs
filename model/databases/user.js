const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");

const User = sequelize.define("user", {
  id: {
    primaryKey: true,
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: false
  },
  cash_point: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    allowNull: false
  },
  game_point: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    allowNull: false 
  }
});

module.exports = User;
