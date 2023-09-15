const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");
const User = require("./user");

const UserGamePointVideo = sequelize.define("user_game_point_video", {
  watched_time: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: User.id
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
    // defaultValue: Date
  },
  type: {
    type: DataTypes.ENUM(["video", "spin", "scratch"])
  }

});

module.exports = UserGamePointVideo;
