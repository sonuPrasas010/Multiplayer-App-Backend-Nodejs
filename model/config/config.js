const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  `${process.env.DB_DATABASE}`,
  `${process.env.DB_USER}`,
  null,
  {
    host: `${process.env.DB_HOST}`,
    dialect: "mysql"
  }
);

module.exports = sequelize;
