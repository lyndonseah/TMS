const pool = require("../config/database");
const { checkGroup } = require("./authController");
const nodemailer = require("nodemailer");

const task_state = {
  open: "Open",
  todo: "ToDo",
  doing: "Doing",
  done: "Done",
  close: "Close"
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
      auditEntry = `>${username} demoted the task, current task state at ${task_state}, at ${dateTime}.ͻNotes entry: "${notes}"`;
      break;
    case "update-plan":
      auditEntry = `>${username} updated task plan when task state at ${task_state}, at ${dateTime}.ͻNotes entry: "${notes}"`;
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

// Get tasks by state (to display one by one, each column)
exports.getTasksByState = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const { task_state, task_appAcronym } = req.body;

  if (!task_state || !task_appAcronym) {
    return res.status(400).json({ message: "Task State and App_Acronym must be provided." });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT t.*, p.plan_mvpName, p.plan_colour
      FROM task t LEFT JOIN plan p 
      ON t.task_plan = p.plan_mvpName AND t.task_appAcronym = p.plan_appAcronym
      WHERE t.task_state = ? AND t.task_appAcronym = ?`,
      [task_state, task_appAcronym]
    );

    if (rows.length === 0) {
      return res.status(200).json({ success: true, rows, message: "No task(s) in this state." });
    }

    res.status(200).json({ success: true, rows, message: "Task(s) fetched successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get task(s) by state." });
  }
};

// Create task
exports.createTask = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const { task_name, task_description, task_notes, task_plan, task_appAcronym, task_creator, task_owner } = req.body;

  if (!task_name || !task_appAcronym || !task_creator || !task_owner) {
    return res.status(400).json({ message: "Task_Name, Task_App_Acronym, Task_Creator, and Task_Owner must be provided." });
  }

  const [group] = await pool.execute(`SELECT app_permitCreate FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  const isAuthorized = await checkGroup(req.user.username, [group[0].app_permitCreate]);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    await pool.query(`START TRANSACTION;`);

    const [acronymRows] = await pool.execute(`SELECT app_acronym FROM application WHERE app_acronym = ?`, [task_appAcronym]);

    if (acronymRows.length === 0) {
      return res.status(404).json({ message: "App_Acronym does not exists." });
    }

    const [app_rNumber] = await pool.query(`SELECT app_rNumber FROM application WHERE app_acronym = ?`, [task_appAcronym]);

    if (app_rNumber.length === 0) {
      return res.status(404).json({ message: "App_Acronym not found." });
    }

    const rNumber = app_rNumber[0].app_rNumber + 1;
    const task_id = `${task_appAcronym}_${rNumber}`;

    await pool.query(`UPDATE application SET app_rNumber = ? WHERE app_acronym = ?`, [rNumber, task_appAcronym]);

    const task_createDate = getCurrentDate();

    await pool.query(
      `INSERT INTO task (task_id, task_name, task_description, task_notes, task_plan, 
      task_appAcronym, task_creator, task_owner, task_createDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [task_id, task_name, task_description || null, task_notes || null, task_plan || null, task_appAcronym, task_creator, task_owner, task_createDate]
    );

    await auditTrail(task_id, req.user.username, task_state.open, "create");
    await pool.query(`COMMIT;`);

    res.status(201).json({ success: true, message: `Task '${task_id}' created successfully.` });
  } catch (error) {
    await pool.query(`ROLLBACK;`);
    return res.status(500).json({ message: "Failed to create task." });
  }
};

// Promote Open to ToDo
exports.promoteTask2ToDo = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const { task_id, task_appAcronym, task_owner } = req.body;

  if (!task_id || !task_appAcronym || !task_owner) {
    return res.status(400).json({ message: "Task_ID, Task_App_Acronym, and Task_Owner must be provided." });
  }

  const [group] = await pool.execute(`SELECT app_permitOpen FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  const isAuthorized = await checkGroup(req.user.username, [group[0].app_permitOpen]);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    await pool.query(`START TRANSACTION;`);

    const [rows] = await pool.query(
      `UPDATE task SET task_state = '${task_state.todo}', task_owner = ? 
      WHERE task_id = ? AND task_state = '${task_state.open}'`,
      [task_owner, task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    await auditTrail(task_id, req.user.username, task_state.todo, "promote");
    await pool.query(`COMMIT;`);

    res.status(200).json({ success: true, message: "Task has been promoted from Open to ToDo successfully." });
  } catch (error) {
    await pool.query(`ROLLBACK;`);
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

// Promote ToDo to Doing
exports.promoteTask2Doing = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const { task_id, task_appAcronym, task_owner } = req.body;

  if (!task_id || !task_appAcronym || !task_owner) {
    return res.status(400).json({ message: "Task_ID, Task_App_Acronym, and Task_Owner must be provided." });
  }

  const [group] = await pool.execute(`SELECT app_permitToDoList FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  const isAuthorized = await checkGroup(req.user.username, [group[0].app_permitToDoList]);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    await pool.query(`START TRANSACTION;`);

    const [rows] = await pool.query(
      `UPDATE task SET task_state = '${task_state.doing}', task_owner = ? 
      WHERE task_id = ? AND task_state = '${task_state.todo}'`,
      [task_owner, task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    await auditTrail(task_id, req.user.username, task_state.doing, "promote");
    await pool.query(`COMMIT;`);

    res.status(200).json({ success: true, message: "Task has been promoted from ToDo to Doing successfully." });
  } catch (error) {
    await pool.query(`ROLLBACK;`);
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

// Demote Doing to ToDo
exports.demoteTask2ToDo = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const { task_id, task_appAcronym, task_owner } = req.body;

  if (!task_id || !task_appAcronym || !task_owner) {
    return res.status(400).json({ message: "Task_ID, Task_App_Acronym, and Task_Owner must be provided." });
  }

  const [group] = await pool.execute(`SELECT app_permitDoing FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  const isAuthorized = await checkGroup(req.user.username, [group[0].app_permitDoing]);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    await pool.query(`START TRANSACTION;`);

    const [rows] = await pool.query(
      `UPDATE task SET task_state = '${task_state.todo}', task_owner = ? 
      WHERE task_id = ? AND task_state = '${task_state.doing}'`,
      [task_owner, task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    await auditTrail(task_id, req.user.username, task_state.todo, "demote");
    await pool.query(`COMMIT;`);

    res.status(200).json({ success: true, message: "Task has been demoted from Doing to ToDo successfully." });
  } catch (error) {
    await pool.query(`ROLLBACK;`);
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

// Promote Doing to Done
exports.promoteTask2Done = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const { task_id, task_appAcronym } = req.body;

  if (!task_id || !task_appAcronym || !task_owner) {
    return res.status(400).json({ message: "Task_ID, Task_App_Acronym, and Task_Owner must be provided." });
  }

  const [group] = await pool.execute(`SELECT app_permitDoing, app_permitDone FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  const isAuthorized = await checkGroup(req.user.username, [group[0].app_permitDoing]);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    await pool.query(`START TRANSACTION;`);

    const [rows] = await pool.query(
      `UPDATE task SET task_state = '${task_state.done}', task_owner = ? 
      WHERE task_id = ? AND task_state = '${task_state.doing}'`,
      [task_owner, task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    await auditTrail(task_id, req.user.username, task_state.done, "promote");
    await pool.query(`COMMIT;`);

    res.status(200).json({ success: true, message: `Email sent to member in the '${group[0].app_permitDone}' group requesting for review. ` });
    triggerEmail(task_id);
  } catch (error) {
    await pool.query(`ROLLBACK;`);
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

// Demote Done to Doing
exports.demoteTask2Doing = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const { task_id, task_appAcronym, task_owner } = req.body;

  if (!task_id || !task_appAcronym || !task_owner) {
    return res.status(400).json({ message: "Task_ID, Task_App_Acronym, and Task_Owner must be provided." });
  }

  const [group] = await pool.execute(`SELECT app_permitDone FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  const isAuthorized = await checkGroup(req.user.username, [group[0].app_permitDone]);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    await pool.query(`START TRANSACTION;`);

    const [rows] = await pool.query(
      `UPDATE task SET task_state = '${task_state.doing}', task_owner = ? 
      WHERE task_id = ? AND task_state = '${task_state.done}'`,
      [task_owner, task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    await auditTrail(task_id, req.user.username, task_state.doing, "demote");
    await pool.query(`COMMIT;`);

    res.status(200).json({ success: true, message: "Task has been demoted from Done to Doing successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to demote task." });
  }
};

// Promote Done to Close
exports.promoteTask2Close = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const { task_id, task_appAcronym, task_owner } = req.body;

  if (!task_id || !task_appAcronym || !task_owner) {
    return res.status(400).json({ message: "Task_ID, Task_App_Acronym, and Task_Owner must be provided." });
  }

  const [group] = await pool.execute(`SELECT app_permitDone FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  const isAuthorized = await checkGroup(req.user.username, [group[0].app_permitDone]);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    await pool.query(`START TRANSACTION;`);

    const [rows] = await pool.execute(
      `UPDATE task SET task_state = '${task_state.close}', task_owner = ? 
      WHERE task_id = ? AND task_state = '${task_state.done}'`,
      [task_owner, task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    await auditTrail(task_id, req.user.username, task_state.close, "promote");
    await pool.query(`COMMIT;`);

    res.status(200).json({ success: true, message: "Task has been promoted from Done to Close successfully." });
  } catch (error) {
    await pool.query(`ROLLBACK;`);
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

// Update task plan
exports.updateTaskPlan = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const { task_id, task_plan, task_appAcronym, task_owner } = req.body;

  if (!task_id || !task_appAcronym || !task_owner) {
    return res.status(400).json({ message: "Task ID, Task App Acronym, and Task Owner must be provided." });
  }

  const [group] = await pool.execute(`SELECT app_permitOpen, app_permitDone FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  const permits = [group[0].app_permitOpen, group[0].app_permitDone];
  const isAuthorized = await checkGroup(req.user.username, permits);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    await pool.query(`START TRANSACTION;`);

    const [rows] = await pool.query(`UPDATE task SET task_plan = ?, task_owner = ? WHERE task_id = ?`, [task_plan || null, task_owner, task_id]);

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "No update performed or task not found." });
    }

    const [taskRow] = await pool.query(`SELECT task_state FROM task WHERE task_id = ?`, [task_id]);
    const currentTaskState = taskRow[0].task_state;

    await auditTrail(task_id, req.user.username, currentTaskState, "update-plan");
    await pool.query(`COMMIT;`);

    res.status(200).json({ success: true, message: "Task plan updated successfully." });
  } catch (error) {
    await pool.query(`ROLLBACK;`);
    return res.status(500).json({ message: "Failed to update task plan." });
  }
};

// Update notes
exports.updateNotes = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const { task_id, task_notes, task_appAcronym, task_owner } = req.body;

  if (!task_id || !task_appAcronym || !task_owner) {
    return res.status(400).json({ message: "Task ID, Task App Acronym, and Task Owner must be provided." });
  }

  const [group] = await pool.execute(`SELECT app_permitOpen, app_permitToDoList, app_permitDoing, app_permitDone FROM application WHERE app_acronym = ?`, [task_appAcronym]);
  const permits = [group[0].app_permitOpen, group[0].app_permitToDoList, group[0].app_permitDoing, group[0].app_permitDone];
  const isAuthorized = await checkGroup(req.user.username, permits);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    await pool.query(`START TRANSACTION;`);

    const [taskRow] = await pool.query(`SELECT task_state FROM task WHERE task_id = ?`, [task_id]);
    if (taskRow.length === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task_App_Acronym." });
    }
    const currentTaskState = taskRow[0].task_state;
    await auditTrail(task_id, req.user.username, currentTaskState, "update-notes", task_notes);
    await pool.query(`COMMIT;`);

    res.status(200).json({ success: true, message: "Task notes updated successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update notes." });
  }
};

// Get one task (get task detail)
// exports.getTask = async (req, res, next) => {
//   if (!req.user) {
//     return res.status(401).json({ message: "Authentication required." });
//   }

//   const { task_id } = req.body;

//   if (!task_id) {
//     return res.status(400).json({ message: "Task_ID must be provided." });
//   }

//   try {
//     const [rows] = await pool.execute(`SELECT * FROM task WHERE task_id = ?`, [task_id]);

//     if (rows.length === 0) {
//       return res.status(404).json({ message: "Task not found." });
//     }

//     res.status(200).json({ success: true, task: rows[0], message: "Task fetched successfully." });
//   } catch (error) {
//     return res.status(500).json({ message: "Failed to fetch task." });
//   }
// };
