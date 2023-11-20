const User = require("../model/databases/user");

function seedUser() {
  User.create({
    name: "Sonu Dhakal",
    email: "sonudhakal010@gmail.com",
    game_point: 100000

  });
  User.create({
    name: "Oman Rai",
    email: "oman@gmail.com",
    game_point: 100000
  });
  User.create({
    name: "Sonu Dhakal",
    email: "sonu@koshistjames.edu.np",
    game_point: 100000
  });
}

module.exports = seedUser;
