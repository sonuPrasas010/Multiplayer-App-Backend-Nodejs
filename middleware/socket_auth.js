const jwt = require("jsonwebtoken");

/**
 * 
 * @param {import('socket.io').Socket} socket 
 * @param {Function} next 
 */
module.exports = (socket, next) => {
  // Extract the token from the query parameters or headers sent by the client
  const token = socket.handshake.query.token || socket.request.headers.token;

  // Verify and decode the token
  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return next(new Error("Authentication error"));
    }

    // Attach the decoded token payload (e.g., user ID) to the socket object
    // console.log(decoded);
    socket.userId = decoded.id;
    next();
  });
};
