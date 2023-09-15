const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");

const TeenPattiMatch = sequelize.define("teen_patti_match", {
  id: {
    primaryKey: true,
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true
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
  started_on: {
    type: DataTypes.DATE
  },

  gameStatus: {
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
  }
});

TeenPattiMatch.beforeUpdate(async() => {
  
})

module.exports = TeenPattiMatch;
