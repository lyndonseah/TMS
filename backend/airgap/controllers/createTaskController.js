const pool = require("../config/database");
const bcrypt = require("bcryptjs");

const validTaskState = {
  open: "open",
  todo: "todo",
  doing: "doing",
  done: "done",
  close: "close"
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

  // Transaction
  trans1: "T001", // Invalid values
  trans2: "T002", // Value out of range
  trans3: "T003", // Task state error
  trans4: "T004" // Transaction error
};

async function auditTrail(task_id, username, task_state, action, notes = "") {
  const dateTime = getCurrentDateTime();
  let auditEntry = "";

  switch (action) {
    case "create":
      auditEntry = `>${username} created the task, current task state at ${task_state}, at ${dateTime}.ͻNotes entry: "${notes}"`;
      break;
    case "promote":
      auditEntry = `>${username} promoted the task, current task state at ${task_state}, at ${dateTime}.`;
      break;
    case "demote":
      auditEntry = `>${username} demoted the task, current task state at ${task_state}, at ${dateTime}.`;
      break;
    case "update-plan":
      auditEntry = `>${username} updated task plan when task state at ${task_state}, at ${dateTime}.`;
      break;
    case "update-notes":
      auditEntry = `>${username} updated task notes when task state at ${task_state}, at ${dateTime}.ͻNotes entry: "${notes}"`;
      break;
    default:
      auditEntry = `>${username} performed an action on the task, current task state at ${task_state}, at ${dateTime}.`;
  }

  auditEntry = auditEntry + "ͻͻ";

  await pool.query(`UPDATE task SET task_notes = CONCAT(?, IFNULL(task_notes, '')) WHERE task_id = ?`, [auditEntry, task_id]);
}

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

function getCurrentDate() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();

  return `${day}-${month}-${year}`;
}

function getCurrentDateTime() {
  const date = new Date();
  return date.toLocaleString("en-SG", { timeZone: "Asia/Singapore", hour12: false }) + " UTC+08";
}

exports.createTask = async (req, res, next) => {
  if (req.originalUrl !== "/api/task/createTask") {
    return res.status(400).json({ code: bodyCode.url1 });
  }

  const { username, password, task_name, task_description, task_notes, task_plan, task_appAcronym } = req.body;

  if (!username || !password || !task_name || !task_appAcronym) {
    return res.status(400).json({ code: bodyCode.payload1 }); // missing mandatory keys
  }

  try {
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

    const [group] = await pool.execute(`SELECT app_permitCreate FROM application WHERE app_acronym = ?`, [task_appAcronym]);
    const isAuthorized = await checkGroup(username, [group[0].app_permitCreate]);
    if (!isAuthorized) {
      return res.status(403).json({ code: bodyCode.auth3 }); // insufficient group permission
    }

    const [acronymRows] = await pool.execute(`SELECT app_acronym FROM application WHERE app_acronym = ?`, [task_appAcronym]);
    if (acronymRows.length === 0) {
      return res.status(404).json({ code: bodyCode.trans1 }); // invalid values
    }

    if (task_name.length > 64) {
      return res.status(400).json({ code: bodyCode.trans2 }); // value out of range
    }

    if (task_description && task_description.length > 255) {
      return res.status(400).json({ code: bodyCode.trans2 }); // value out of range
    }

    if (task_notes && task_notes.length > 65535) {
      return res.status(400).json({ code: bodyCode.trans2 }); // value out of range
    }

    if (task_plan) {
      const [planRow] = await pool.execute(`SELECT plan_mvpName FROM plan WHERE plan_mvpName = ? AND plan_appAcronym = ?`, [task_plan, task_appAcronym]);
      if (planRow.length === 0) {
        return res.status(404).json({ code: bodyCode.trans1 }); // invalid value
      }
    }

    await pool.query(`START TRANSACTION;`);

    const [app_rNumber] = await pool.query(`SELECT app_rNumber FROM application WHERE app_acronym = ?`, [task_appAcronym]);
    const rNumber = app_rNumber[0].app_rNumber + 1;
    const task_id = `${task_appAcronym}_${rNumber}`;

    await pool.query(`UPDATE application SET app_rNumber = ? WHERE app_acronym = ?`, [rNumber, task_appAcronym]);

    const task_creator = username;
    const task_owner = username;
    const task_createDate = getCurrentDate();

    await pool.query(
      `INSERT INTO task (task_id, task_name, task_description, task_plan, 
      task_appAcronym, task_creator, task_owner, task_createDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [task_id, task_name, task_description || null, task_plan || null, task_appAcronym, task_creator, task_owner, task_createDate]
    );

    await auditTrail(task_id, task_owner, validTaskState.open, "create", task_notes);
    await pool.query(`COMMIT;`);

    res.status(201).json({ task_id, code: bodyCode.generalSuccess }); // success
  } catch (error) {
    await pool.query(`ROLLBACK;`);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ code: bodyCode.trans4 }); // transaction error
    }
    return res.status(500).json({ code: bodyCode.generalError }); // internal server error
  }
};
