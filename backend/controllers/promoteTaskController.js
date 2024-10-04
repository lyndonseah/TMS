const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

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
  payload4: "P004", // Task state error

  // Transaction
  trans1: "T001" // Transaction update error
};

async function auditTrail(task_id, username, task_state, action, notes = "") {
  const dateTime = getCurrentDateTime();
  let auditEntry = "";

  switch (action) {
    case "create":
      auditEntry = `>${username} created the task, current task state at ${task_state}, at ${dateTime}.ͻNotes entry: "${notes}"`;
      break;
    case "promote":
      auditEntry = `>${username} promoted the task, current task state at ${task_state}, at ${dateTime}.ͻNotes entry: "${notes}"`;
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

function getCurrentDateTime() {
  const date = new Date();
  return date.toLocaleString("en-SG", { timeZone: "Asia/Singapore", hour12: false }) + " UTC+08";
}

async function triggerEmail(task_id) {
  try {
    const [taskRow] = await pool.query(`SELECT task_name, task_appAcronym FROM task WHERE task_id = ?`, [task_id]);
    if (taskRow.length === 0) {
      console.error("Task does not exist.");
      return;
    }

    const taskName = taskRow[0].task_name;
    const taskAppAcronym = taskRow[0].task_appAcronym;

    const [appRow] = await pool.query(`SELECT app_permitDone FROM application WHERE app_acronym = ?`, [taskAppAcronym]);
    if (appRow.length === 0) {
      console.error("Application does not exist.");
      return;
    }

    const appPermitDoneGroup = appRow[0].app_permitDone;
    if (!appPermitDoneGroup) {
      console.error("Application does not have app_permitDone group assigned.");
      return;
    }

    const [groupRow] = await pool.query(`SELECT group_id FROM group_list WHERE group_name = ?`, [appPermitDoneGroup]);
    if (groupRow.length === 0) {
      console.error(`Group '${appPermitDoneGroup}' does not exist in group_list.`);
      return;
    }

    const groupId = groupRow[0].group_id;

    const [usersInGroup] = await pool.query(`SELECT username FROM user_group WHERE group_id = ?`, [groupId]);
    if (usersInGroup.length === 0) {
      console.error(`No users found in group '${appPermitDoneGroup}'.`);
      return;
    }

    const usernames = usersInGroup.map(row => row.username);

    const [emailRows] = await pool.query(`SELECT email FROM users WHERE username IN (?)`, [usernames]);
    if (emailRows.length === 0) {
      console.error("No emails found for users in app_permitDone group.");
      return;
    }

    const recipientEmails = emailRows.map(row => row.email).filter(email => email);
    if (recipientEmails.length === 0) {
      console.error("No valid emails found for users in app_permitDone group.");
      return;
    }

    const emailContent = {
      from: "Task Management System <noreply@tms.com>",
      to: recipientEmails.join(","),
      subject: "Task Review Required",
      text: `The task '${taskName}' has been promoted to 'Done' state and requires your review.\n\nTask Management System`
    };

    const transporter = nodemailer.createTransport({
      host: process.env.YOUR_MAILTRAP_HOST,
      port: process.env.YOUR_MAILTRAP_PORT,
      auth: {
        user: process.env.YOUR_MAILTRAP_USERNAME,
        pass: process.env.YOUR_MAILTRAP_PASSWORD
      }
    });

    const info = await transporter.sendMail(emailContent);
    console.log("Email sent:", info.messageId);
  } catch (error) {
    console.error(error);
  }
}

exports.promoteTask2Done = async (req, res, next) => {
  if (req.originalUrl !== "/api/task/promoteTask2Done") {
    return res.status(400).json({ code: bodyCode.url1 });
  }

  const { username, password, task_id } = req.body;

  if (!username || !password || !task_id) {
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

  const [taskRow] = await pool.query(`SELECT task_id, task_state, task_appAcronym FROM task WHERE task_id = ?`, [task_id]);
  if (taskRow.length === 0) {
    return res.status(404).json({ code: bodyCode.payload2 }); // invalid value
  }

  const task = taskRow[0];

  if (task.task_state !== validTaskState.doing) {
    return res.status(400).json({ code: bodyCode.payload4 }); // task state error
  }

  const [group] = await pool.execute(`SELECT app_permitDoing, app_permitDone FROM application WHERE app_acronym = ?`, [task.task_appAcronym]);
  const isAuthorized = await checkGroup(username, [group[0].app_permitDoing]);
  if (!isAuthorized) {
    return res.status(403).json({ code: bodyCode.auth3 }); // insufficient group permission
  }

  const task_owner = username;

  try {
    await pool.query(`START TRANSACTION;`);

    const [rows] = await pool.query(
      `UPDATE task SET task_state = ?, task_owner = ?
       WHERE task_id = ? AND task_state = ?`,
      [validTaskState.done, task_owner, task_id, validTaskState.doing]
    );

    if (rows.affectedRows === 0) {
      return res.status(400).json({ code: bodyCode.trans1 }); // transaction update error
    }

    await auditTrail(task_id, task_owner, validTaskState.done, "promote");
    await pool.query(`COMMIT;`);

    res.status(200).json({ code: bodyCode.generalSuccess });
    triggerEmail(task_id);
  } catch (error) {
    await pool.query(`ROLLBACK;`);
    return res.status(500).json({ code: bodyCode.generalError });
  }
};
