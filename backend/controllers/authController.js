const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/errorHandler");

async function checkGroup(username, group_name) {
  const [rows] = await pool.query(
    `SELECT 1 FROM user_group ug JOIN group_list gl 
    ON ug.group_id = gl.group_id WHERE ug.username = ? 
    AND gl.group_name IN (?) LIMIT 1`,
    [username, group_name]
  );

  if (rows.length === 0) {
    return false;
  }

  return true;
}

exports.login = async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return next(new ErrorHandler("Username and Password must be provided.", 400));
  }

  try {
    const [rows] = await pool.execute("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      return next(new ErrorHandler("Invalid credentials.", 400));
    }

    const user = rows[0];

    if(user.active === 0 ) {
      return res.status(403).json({ message: "Your account is disabled, please contact IT." })
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    const isAuthorized = await checkGroup(username, ["ADMIN"]);

    // Generate token
    const token = jwt.sign(
      {
        username: username,
        ipaddress: req.ip,
        browser: req.headers["user-agent"],
        isAuthorized: isAuthorized
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.EXPIRE_time * 1000 * 60 * 60 // 1000 for ms
      }
    );

    const options = {
      expires: new Date(Date.now() + process.env.EXPIRE_TIME * 1000 * 60 * 60),
      httpOnly: true
    };

    // Sent to the client as part of an HTTP cookie
    res.status(200).cookie("token", token, options).json({
      message: "Login success.",
      success: true,
      isAuthorized: isAuthorized,
      token
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed." })
  }
};

exports.logout = async (req, res) => {
  res.clearCookie("token").status(200).send({ message: "Logout success." });
};

module.exports.checkGroup = checkGroup;
