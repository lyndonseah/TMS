const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const ErrorHandler = require("../utils/errorHandler");

// When pass an argument to .next(), it will treat it as an error and skip all other non-error middleware functions

async function checkGroup(username, group_name) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM user_group ug JOIN group_list gl 
    ON ug.group_id = gl.group_id WHERE ug.username = ? 
    AND gl.group_name = ? LIMIT 1`,
    [username, group_name]
  );
  return rows.length > 0; // return true or false
}

// Controller to fetch myself
exports.getUser = async (req, res, next) => {
  // req.user is set by the verifyToken middleware
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAdmin = await checkGroup(req.user.username, "Admin");

  try {
    const username = req.user.username;
    const [rows] = await pool.execute("SELECT username, email FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      return next(new ErrorHandler("User not found", 404));
    }

    res.json({ success: true, user: rows[0], isAdmin: isAdmin });
  } catch (error) {
    return next(new ErrorHandler("Failed to get all users.", 500));
  }
};

// Controller to fetch all users
exports.getUsers = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAdmin = await checkGroup(req.user.username, "Admin");

  if (!isAdmin) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  try {
    const [rows] = await pool.execute("SELECT username, email, active FROM users");
    if (rows.length > 0) {
      res.json({ success: true, rows, isAdmin: isAdmin });
    } else {
      return next(new ErrorHandler("No users found.", 404));
    }
  } catch (error) {
    return next(new ErrorHandler("Failed to get all users.", 500));
  }
};

// Controller to create new user
exports.createUser = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAdmin = await checkGroup(req.user.username, "Admin");

  if (!isAdmin) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  const { username, password, email } = req.body;

  if (!username || !password) {
    return next(new ErrorHandler("Username and Password must be provided.", 400));
  }

  const usernameRegex = /^[A-Za-z0-9]+$/;
  if (!usernameRegex.test(username)) {
    return next(new ErrorHandler("Username must be alphanumeric.", 400));
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
      return next(new ErrorHandler("Invalid email format.", 400));
    }
  }

  try {
    const [usernameRows] = await pool.execute("SELECT username FROM users WHERE username = ?", [username]);
    if (usernameRows.length > 0) {
      return res.status(409).json({ error: "USERNAME_TAKEN", message: "Username already exists, choose another." });
    }

    if (email) {
      const [emailRows] = await pool.execute("SELECT email FROM users WHERE email = ?", [email]);
      if (emailRows.length > 0) {
        return res.status(409).json({ error: "EMAIL_TAKEN", message: "Email already exists, choose another." });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.execute("INSERT INTO users (username, password, email, active) VALUES (?, ?, ?, 1)", [username, hashedPassword, email || null]);

    res.status(201).json({ message: `User ${username} created successfully.`, username: username, success: true, isAdmin: isAdmin });
  } catch (error) {
    return next(new ErrorHandler("Failed to create new user.", 500));
  }
};

// Controller to enable/disable user
exports.disableUser = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAdmin = await checkGroup(req.user.username, "Admin");
  if (!isAdmin) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  const { username } = req.body;

  if (!username) {
    return next(new ErrorHandler("Username must be provided.", 400));
  }

  if (username === "Admin") {
    return next(new ErrorHandler("Cannot disable the 'Admin' account.", 400));
  }

  try {
    const [rows] = await pool.execute("UPDATE users SET active = 0 WHERE username = ?", [username]);
    if (rows.affectedRows === 0) {
      return next(new ErrorHandler("User not found.", 404));
    }

    res.status(200).json({ message: `User '${username}' has been disabled.`, success: true, isAdmin: isAdmin });
  } catch (error) {
    return next(new ErrorHandler("Failed to disable user.", 500));
  }
};

// Controller for reset credentials (password/email)
exports.resetCredentials = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAdmin = await checkGroup(req.user.username, "Admin");

  if (!isAdmin) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  const { username, password, email } = req.body;

  if (!username) {
    return next(new ErrorHandler("Username must be provided.", 400));
  }

  const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*-=_+,.]).{8,10}$/;
  if (password && (password.length < 8 || password.length > 10 || !pwRegex.test(password))) {
    return res.status(400).json({ error: "PW_REQ_FAIL" });
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

    res.status(200).json({ message: `Credentials for user '${username}' have been reset/updated.`, success: true, isAdmin: isAdmin });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "EMAIL_TAKEN", message: "Email already exists, choose another." });
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

  try {
    const [updateResult] = await pool.execute("UPDATE users SET email = ? WHERE username = ?", [newEmail, username]);

    if (updateResult.affectedRows === 0) {
      return next(new ErrorHandler("No update performed, user not found or email unchanged.", 404));
    }

    res.status(200).json({ success: true, message: `Email for '${username}' is updated successfully.` });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "EMAIL_TAKEN", message: "Email already exists." });
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
    return next(new ErrorHandler("Password must be between 8 and 10 characters.", 400));
  }

  const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*-=_+,.]).{8,10}$/;
  if (password && !pwRegex.test(password)) {
    return next(new ErrorHandler("Password must include at least one alphabet, one number, and one special character.", 400));
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [updateResult] = await pool.execute("UPDATE users SET password = ? WHERE username = ?", [hashedPassword, username]);

    if (updateResult.affectedRows === 0) {
      return next(new ErrorHandler("No update performed, user not found or password unchanged.", 404));
    }

    res.status(200).json({ success: true, message: `Password for user '${username}' has been updated successfully.` });
  } catch (error) {
    return next(new ErrorHandler("Failed to update password.", 500));
  }
};

module.exports.checkGroup = checkGroup;
