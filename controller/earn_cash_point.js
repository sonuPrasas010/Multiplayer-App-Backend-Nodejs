const { request, response } = require("express");
const { lookup } = require("geoip-lite");
const { Op } = require("sequelize");
const CountryReward = require("../model/databases/country_reward");
const UserCashPointVideo = require("../model/databases/user_cash_point_video");
const { sendGoodResponse, sendBadResponse } = require("../utilty");
const User = require("../model/databases/user");

const getCashPointVideo = async (req = request, res = response) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(ip); // ip address of the user
  const userInfo = (lookup("2402:6640:17:9115:45ce:40f:34ea:66e7")); // location of the user
  
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const now = new Date();
  
  const country = await CountryReward.findOne({ where: { country_code: userInfo.country } });
  const userGamePoint = await UserCashPointVideo.findOne({
    where: {
      created: { 
        [Op.gt]: todayStart,
        [Op.lt]: now
      },
      user_id: req.user_id,
      type: "video"
    } 
  });
  const data = {};
  data.totalWatchedTime = userGamePoint?.watched_time || 0;
  data.reward = country.reward;
  return sendGoodResponse(res, { status: "success", message: "success fully fetched", data });
}

const collectCashPointVideo = async (req = request, res = response) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(ip); // ip address of the user
  const userInfo = (lookup("2402:6640:17:9115:45ce:40f:34ea:66e7")); // location of the user

  const todayStart = new Date().setHours(0, 0, 0, 0);
  const now = new Date();

  const country = await CountryReward.findOne({ 
    where: { 
      country_code: userInfo.country
    }
  });
  const userGamePoint = await UserCashPointVideo.findOrCreate({
    where: {
      created: { 
        [Op.gt]: todayStart,
        [Op.lt]: now
      },
      user_id: req.user_id,
      type: "video"
    }    
  });

  if (userGamePoint.watched_time >= 25) { 
    return sendBadResponse(response, { status: "failed", message: "already reached limit" });
  }

  await userGamePoint[0].increment("watched_time");
  await User.increment("game_point", { by: country.reward });
  
  return sendGoodResponse(res, { status: "success", message: ` Game point ${country.reward} colected` });
}
module.exports = {
  getCashPointVideo,
  collectCashPointVideo
}
