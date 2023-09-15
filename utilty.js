const { response } = require("express");

function sendGoodResponse (res = response, data) {
  response.send(data);
}

function sendBadResponse (res = response, data) {
  res.status(400).send(data);
}

module.exports = {
  sendGoodResponse,
  sendBadResponse
}
