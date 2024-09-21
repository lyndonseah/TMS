const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/errorHandler");

exports.verifyTokenAccess = async (req, res, next) => {
  // get the token inside the cookie
  const token = req.cookies.token; //.token is a name set in authController

  if (!token) {
    return next(new ErrorHandler("Access denied. No token provided.", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.browser != req.headers["user-agent"] || decoded.ipaddress != req.ip) {
      return next(new ErrorHandler("Invalid token.", 401));
    }

    req.user = decoded; // this user will have all the payload information for easier use later
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new ErrorHandler("Your session has expired. Please log in again.", 401));
    } else {
      return next(new ErrorHandler("Invalid token.", 401));
    }
  }
};
