const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/errorHandler");
const { checkGroup } = require("./userController");

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
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return next(new ErrorHandler("Invalid credentials.", 400));
    }

    const isAdmin = await checkGroup(username, "Admin");

    // Generate token
    const token = jwt.sign(
      {
        username: username,
        ipaddress: req.ip,
        browser: req.headers["user-agent"],
        isAdmin: isAdmin
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
      isAdmin: isAdmin,
      token
    });
  } catch (error) {
    return next(new ErrorHandler("Login failed.", 500));
  }
};

exports.logout = async (req, res) => {
  res.clearCookie("token").status(200).send({ message: "Logout success." });
};
