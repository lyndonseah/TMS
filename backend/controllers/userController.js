const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const ErrorHandler = require("../utils/errorHandler");
const { checkGroup } = require("./authController");

// When pass an argument to .next(), it will treat it as an error and skip all other non-error middleware functions

// Controller to fetch myself
exports.getUser = async (req, res, next) => {
  // req.user is set by the verifyToken middleware
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAuthorized = await checkGroup(req.user.username, ["Admin"]);

  const username = req.user.username;

  try {
    const [rows] = await pool.execute("SELECT username, email FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      return next(new ErrorHandler("User not found", 404));
    }

    res.status(200).json({ success: true, user: rows[0], isAuthorized: isAuthorized, message: "User's details fetched successfully." });
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch user's details.", 500));
  }
};

// Controller to fetch all users
exports.getUsers = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAuthorized = await checkGroup(req.user.username, ["Admin"]);

  if (!isAuthorized) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  try {
    const [rows] = await pool.execute("SELECT username, email, active FROM users");
    
    if (rows.length > 0) {
      res.status(200).json({ success: true, rows, message: "User(s) fetched successfully." });
    } else {
      return next(new ErrorHandler("No user(s) found.", 404));
    }
    
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch all user(s).", 500));
  }
};

// Controller to create new user
exports.createUser = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAuthorized = await checkGroup(req.user.username, ["Admin"]);

  if (!isAuthorized) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  const { username, password, email } = req.body;

  if (!username || !password) {
    return next(new ErrorHandler("Username and Password must be provided.", 400));
  }

  const usernameRegex = /^[A-Za-z0-9]+$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ message: "Username must be alphanumeric." });
  }

  if (password.length < 8 || password.length > 10) {
    return next(new ErrorHandler("Password must be between 8 and 10 characters.", 400));
  }

  const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*-=_+,.]).{8,10}$/;
  if (!pwRegex.test(password)) {
    return next(new ErrorHandler("Password must include one alphabet, one number, and one special character.", 400));
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format. (Example format: xxx@xxx.com)" });
    }
  }

  try {
    const [usernameRows] = await pool.execute("SELECT username FROM users WHERE username = ?", [username]);
    if (usernameRows.length > 0) {
      return res.status(409).json({ message: "Username already exists, choose another." });
    }

    if (email) {
      const [emailRows] = await pool.execute("SELECT email FROM users WHERE email = ?", [email]);
      if (emailRows.length > 0) {
        return res.status(409).json({ message: "Email already exists, choose another." });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.execute("INSERT INTO users (username, password, email, active) VALUES (?, ?, ?, 1)", [username, hashedPassword, email || null]);

    res.status(201).json({ message: `User ${username} created successfully.`, username: username, success: true });
  } catch (error) {
    return next(new ErrorHandler("Failed to create new user.", 500));
  }
};

// Controller to enable/disable user
exports.disableUser = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required.", 401));
  }

  const isAuthorized = await checkGroup(req.user.username, ["Admin"]);
  if (!isAuthorized) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  const { username } = req.body;

  if (!username) {
    return next(new ErrorHandler("Username must be provided.", 400));
  }

  try {
    const [rows] = await pool.execute("UPDATE users SET active = 0 WHERE username = ?", [username]);
    if (rows.affectedRows === 0) {
      return next(new ErrorHandler("User not found.", 404));
    }

    res.status(200).json({ message: `User '${username}' has been disabled successfully.`, success: true });
  } catch (error) {
    return next(new ErrorHandler("Failed to disable user.", 500));
  }
};

// Controller for reset credentials (password/email)
exports.resetCredentials = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAuthorized = await checkGroup(req.user.username, ["Admin"]);

  if (!isAuthorized) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  const { username, password, email } = req.body;

  if (!username) {
    return next(new ErrorHandler("Username must be provided.", 400));
  }

  const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*-=_+,.]).{8,10}$/;
  if (password && (password.length < 8 || password.length > 10 || !pwRegex.test(password))) {
    return res.status(400).json({ message: "Password must be 8-10 characters, and at least one alphabet, one number, and one special character." });
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format. (Example format: xxx@xxx.com)" });
    }
  }

  try {
    let hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    let query = "UPDATE users SET ";
    let params = [];

    if (hashedPassword) {
      query += "password = ?, ";
      params.push(hashedPassword);
    }

    if (email) {
      query += "email = ?, ";
      params.push(email);
    }

    // remove ending comma and whitespace
    query = query.slice(0, -2);

    query += " WHERE username = ?";
    params.push(username);

    const [rows] = await pool.execute(query, params);
    if (rows.affectedRows === 0) {
      return next(new ErrorHandler("User not found.", 404));
    }

    res.status(200).json({ message: `Credentials for user '${username}' is reset/updated successfully.`, success: true });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already exists, choose another." });
    }
    return next(new ErrorHandler("Failed to reset credentials.", 500));
  }
};

exports.updateEmail = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const { newEmail } = req.body;
  const username = req.user.username;

  if (!newEmail) {
    return next(new ErrorHandler("Email must be provided.", 400));
  }

  if (newEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ message: "Invalid email format. (Example format: xxx@xxx.com)" });
    }
  }

  try {
    const [updateResult] = await pool.execute("UPDATE users SET email = ? WHERE username = ?", [newEmail, username]);

    if (updateResult.affectedRows === 0) {
      return next(new ErrorHandler("No update performed, user not found or email unchanged.", 404));
    }

    res.status(200).json({ success: true, message: `Email for '${username}' is updated successfully.` });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already exists." });
    }
    return next(new ErrorHandler("Failed to update email.", 500));
  }
};

exports.updatePassword = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const { password } = req.body;
  const username = req.user.username;

  if (password && (password.length < 8 || password.length > 10)) {
    return res.status(400).json({ message: "Password must be 8-10 characters." });
  }

  const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*-=_+,.]).{8,10}$/;
  if (password && !pwRegex.test(password)) {
    return res.status(400).json({ message: "Password must have at least one alphabet, one number, and one special character." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [updateResult] = await pool.execute("UPDATE users SET password = ? WHERE username = ?", [hashedPassword, username]);

    if (updateResult.affectedRows === 0) {
      return next(new ErrorHandler("No update performed, user not found or password unchanged.", 404));
    }

    res.status(200).json({ success: true, message: `Password for user '${username}' is updated successfully.` });
  } catch (error) {
    return next(new ErrorHandler("Failed to update password.", 500));
  }
};
