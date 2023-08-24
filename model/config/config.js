const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  "laravel",
  "root",
  null,
  {
    host: "localhost",
    dialect: "mysql"
  }
);

module.exports = sequelize;
