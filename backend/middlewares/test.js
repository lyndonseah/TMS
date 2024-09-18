const pool = require("../config/database");
const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/errorHandler");

const checkGroup = async (username, groupname) => {
  try {
    const [rows] = await pool.execute(
      `SELECT group_name FROM group_list gl JOIN user_group ug ON 
        gl.group_id = ug.group_id WHERE ug.username = ? 
        AND gl.group_name IN (?)`,
      [username, groupname]
    );

    if (rows.length === 0) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

exports.verifyTokenCheckGroup = (groups = []) => {
  return async (req, res, next) => {
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

      if (groups.length > 0) {
        if (!(await checkGroup(username, groups))) {
          return res.status(401).json({
            success: false,
            error: "ERR_ADMIN",
            message: "Access denied. You must be authenticated to access this resource."
          });
        }
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
};
