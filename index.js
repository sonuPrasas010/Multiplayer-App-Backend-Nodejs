const sequelize = require("./model/config/config");
require("./model/config/relations");
const { makeMatch, lowCardGameSocket } = require("./controller/low_card");
const { getGamePointVideo, collectGamePointVideo, getGamePointSpin, collectGamePointSpin, getGamePointScratch, collectGamePointScratch } = require("./controller/earn_game_point");
const { teenPattiGameSocket } = require("./controller/teen_patti");
const googleLogin = require("./controller/authentication");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const User = require("./model/databases/user");

// const  seedUser  = require("./seeder/user_seeder")();

const port = 8000;

const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);

// Parse JSON and URL-encoded request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set("trust proxy", true)
dotenv.config();

const testSocketNamespace = io.of("/low-card-game");
lowCardGameSocket(testSocketNamespace)
const teenPattiSocketNamespace = io.of("/teen-patti-game");
teenPattiGameSocket(teenPattiSocketNamespace)

sequelize.authenticate().then(() => {
  console.log("Connection has been established");
  // sequelize.sync({ force: true });
});

app.get("/", async (req, res) => {
  const user = await User.findAll();
  res.send(`Hello World! ${user}`);
});

app.post("/google-signin", googleLogin) 
app.get("/make-match", makeMatch);
app.get("/getGamePointVideo", getGamePointVideo);
app.get("/collectGamePointVideo", collectGamePointVideo);
app.get("/getGamePointSpin", getGamePointSpin);
app.get("/collectGamePointSpin", collectGamePointSpin);
app.get("/getGamePointScratch", getGamePointScratch);
app.get("/collectGamePointScratch", collectGamePointScratch);

http.listen(port, async () => {
  console.log(`http://localhost:${port}/makeMatch`);
  console.log(`Example app listening on port ${port}`);
});
