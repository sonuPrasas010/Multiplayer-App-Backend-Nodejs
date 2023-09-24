const User = require("../model/databases/user");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { sendGoodResponse } = require("../utilty");

/**
 * 
 * @param {import("express").Request } req 
 * @param {import("express").Response} res 
 */
const googleLogin = async (req, res) => {
  const { googleId, email, image, name } = req.body;
  const jwtSecretKey = process.env.JWT_SECRET_KEY;

  const [user] = await User.findOrCreate({ where: { email }, defaults: { image, name } });
  const token = jwt.sign(user.toJSON(), jwtSecretKey);
  const data = {
    status: "success",
    message: "User logged in successfully.",
    data: { ...user.toJSON(), token },
    token
  }
  sendGoodResponse(res, data);
}

module.exports = googleLogin;
