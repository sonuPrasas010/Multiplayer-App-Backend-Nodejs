const sequelize = require("./model/config/config");
require("./model/config/relations");
const { makeMatch, lowCardGameSocket } = require("./controller/low_card");
const { getGamePointVideo, collectGamePointVideo, getGamePointSpin, collectGamePointSpin, getGamePointScratch, collectGamePointScratch } = require("./controller/earn_game_point");
// const  seedUser  = require("./seeder/user_seeder")();

const port = 8000;

const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);

app.set("trust proxy", true)

const testSocketNamespace = io.of("/low-card-game");
lowCardGameSocket(testSocketNamespace)

sequelize.authenticate().then(() => {
  console.log("Connection has been established");
  // sequelize.sync({ force: true });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});
 
app.get("/make-match", makeMatch);
app.get("/getGamePointVideo", getGamePointVideo);
app.get("/collectGamePointVideo", collectGamePointVideo);
app.get("/getGamePointSpin", getGamePointSpin);
app.get("/collectGamePointSpin", collectGamePointSpin);
app.get("/getGamePointScratch", getGamePointScratch);
app.get("/collectGamePointScratch", collectGamePointScratch);

app.get()

http.listen(port, async () => {
  console.log(`http://localhost:${port}/makeMatch`);
  console.log(`Example app listening on port ${port}`);
});
