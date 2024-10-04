const pool = require("../config/database");
const bcrypt = require("bcryptjs");

const validTaskState = {
  open: "Open",
  todo: "ToDo",
  doing: "Doing",
  done: "Done",
  close: "Close"
};

const bodyCode = {
  // Generic success/error
  generalSuccess: "S001", // Success
  generalError: "E001", // Internal Server Error

  // URL
  url1: "U001", // URL don't match

  // Authentication
  auth1: "A001", // Username does not exist or Invalid credentials
  auth2: "A002", // User not active
  auth3: "A003", // Insufficient group permission

  // Payload
  payload1: "P001", // Missing mandatory keys
  payload2: "P002", // Invalid values
  payload3: "P003", // Value out of range
  payload4: "P004" // Task state error
};

exports.getTaskByState = async (req, res, next) => {
  if (req.originalUrl !== "/api/task/getTaskByState") {
    return res.status(400).json({ code: bodyCode.url1 });
  }

  const { username, password, task_state, task_appAcronym } = req.body;

  if (!username || !password || !task_state || !task_appAcronym) {
    return res.status(400).json({ code: bodyCode.payload1 }); // missing mandatory keys
  }

  const [userRows] = await pool.execute("SELECT password, active FROM users WHERE username = ?", [username]);
  if (userRows.length === 0) {
    return res.status(404).json({ code: bodyCode.auth1 }); // account don't exist / invalid credentials
  }

  const user = userRows[0];

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ code: bodyCode.auth1 }); // account don't exist / invalid credentials
  }

  if (!user.active) {
    return res.status(403).json({ code: bodyCode.auth2 }); // user not active
  }

  const [acronymRows] = await pool.execute(`SELECT app_acronym FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  if (acronymRows.length === 0) {
    return res.status(404).json({ code: bodyCode.payload2 }); // invalid values
  }

  if (!Object.values(validTaskState).includes(task_state)) {
    return res.status(400).json({ code: bodyCode.payload2 }); // invalid values
  }

  try {
    const [task] = await pool.execute(
      `SELECT t.*, p.plan_mvpName, p.plan_colour
      FROM task t LEFT JOIN plan p 
      ON t.task_plan = p.plan_mvpName AND t.task_appAcronym = p.plan_appAcronym
      WHERE t.task_state = ? AND t.task_appAcronym = ?`,
      [task_state, task_appAcronym]
    );

    res.status(200).json({ task, code: bodyCode.generalSuccess });
  } catch (error) {
    return res.status(500).json({ code: bodyCode.generalError });
  }
};
