const User = require("../model/databases/user");

function seedUser() {
  User.create({
    name: "Sonu Dhakal",
    email: "sonudhakal010@gmail.com",
    password: "12345678",
    play_point: 1000

  });
  User.create({
    name: "Oman Rai",
    email: "oman@gmail.com",
    password: "12345678",
    play_point: 1000
  });
}

module.exports = seedUser;
