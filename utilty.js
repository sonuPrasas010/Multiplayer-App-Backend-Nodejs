/**
 * Send 200 Response to the client
 * @param {import("express").Response} res 
 * @param {*} data 
 */
function sendGoodResponse (res, data) {
  res.send(data);
}

/**
 * send 400 response to the client
 * @param {import("express").Response} res 
 * @param {*} data 
 */
function sendBadResponse (res, data) {
  res.status(400).send(data);
}
/**
 * 
 * @param {number} duration 
 * @returns 
 */
async function delay(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

module.exports = {
  sendGoodResponse,
  sendBadResponse,
  delay
}
