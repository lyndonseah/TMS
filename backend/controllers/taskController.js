const pool = require("../config/database");
const { checkGroup } = require("./authController");

const task_state = {
  open: "open",
  todo: "todo",
  doing: "doing",
  done: "done",
  close: "close"
};

// Get one task (get task detail)
exports.getTask = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const { task_id } = req.body;

  if (!task_id) {
    return res.status(400).json({ message: "Task_ID must be provided." });
  }

  try {
    const [rows] = await pool.execute(`SELECT * FROM task WHERE task_id = ?`, [task_id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Task not found." });
    }

    res.status(200).json({ success: true, task: rows[0], message: "Task fetched successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch task." });
  }
};

// Get all tasks
// exports.getTasks = async (req, res, next) => {
//   if (!req.user) {
//     return res.status(401).json({ message: "Authentication required." });
//   }

//   try {
//     const [rows] = await pool.execute(`SELECT * FROM task`);

//     if (rows.length > 0) {
//       res.status(200).json({ success: true, rows, message: "Task(s) fetched successfully." });
//     } else {
//       return res.status(404).json({ message: "No task(s) found." });
//     }
//   } catch (error) {
//     return res.status(500).json({ message: "Failed to fetch task(s)." });
//   }
// };

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
      `SELECT t.task_id, t.task_name, t.task_description, t.task_owner, p.plan_colour
      FROM task t LEFT JOIN plan p 
      ON t.task_plan = p.plan_mvpName AND t.task_appAcronym = p.plan_appAcronym
      WHERE t.task_state = ? AND t.task_appAcronym = ?`,
      [task_state, task_appAcronym]
    );

    if (rows.length === 0) {
      res.status(200).json({ success: true, rows, message: "No task(s) in this state." });
    }

    res.status(200).json({ sucess: true, rows, message: "Task(s) fetched successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get task(s) by state." });
  }
};

// Create task
exports.createTask = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }
  
  // THIS WILL BE AUTHORIZED FOR APP_PERMIT_CREATE
  // const isAuthorized = await checkGroup(req.user.username, ["PL"]);

  // if (!isAuthorized) {
  //   return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  // }

  const { task_name, task_description, task_notes, task_plan, task_appAcronym, task_creator, task_owner } = req.body;

  if (!task_name || !task_appAcronym || !task_creator || !task_owner) {
    return res.status(400).json({ message: "Task_Name, Task_App_Acronym, Task_Creator, and Task_Owner must be provided." });
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

    const [rows] = await pool.query(
      `INSERT INTO task (task_id, task_name, task_description, task_notes, task_plan, 
      task_appAcronym, task_creator, task_owner, task_createDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [task_id, task_name, task_description || null, task_notes || null, task_plan || null, task_appAcronym, task_creator, task_owner, task_createDate]
    );

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

  // checkgroup dynamically for app_permit_...

  const { task_id } = req.body;

  if (!task_id) {
    return res.status(400).json({ message: "Task_ID must be provided." });
  }

  try {
    const [rows] = await pool.execute(
      `UPDATE task SET task_state = '${task_state.todo}' 
      WHERE task_id = ? AND task_state = '${task_state.open}'`,
      [task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    res.status(200).json({ success: true, message: "Task has been promoted from Open to ToDo successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

// Promote ToDo to Doing
exports.promoteTask2Doing = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  // checkgroup dynamically for app_permit_...

  const { task_id } = req.body;

  if (!task_id) {
    return res.status(400).json({ message: "Task_ID must be provided." });
  }

  try {
    const [rows] = await pool.execute(
      `UPDATE task SET task_state = '${task_state.doing}' 
      WHERE task_id = ? AND task_state = '${task_state.todo}'`,
      [task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    res.status(200).json({ success: true, message: "Task has been promoted from ToDo to Doing successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

// Demote Doing to ToDo
exports.demoteTask2ToDo = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  // checkgroup dynamically for app_permit_...

  const { task_id } = req.body;

  if (!task_id) {
    return res.status(400).json({ message: "Task_ID must be provided." });
  }

  try {
    const [rows] = await pool.execute(
      `UPDATE task SET task_state = '${task_state.todo}' 
      WHERE task_id = ? AND task_state = '${task_state.doing}'`,
      [task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    res.status(200).json({ success: true, message: "Task has been demoted from Doing to ToDo successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

// Promote Doing to Done
exports.promoteTask2Done = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  // checkgroup dynamically for app_permit_...

  const { task_id } = req.body;

  if (!task_id) {
    return res.status(400).json({ message: "Task_ID must be provided." });
  }

  try {
    const [rows] = await pool.execute(
      `UPDATE task SET task_state = '${task_state.done}' 
      WHERE task_id = ? AND task_state = '${task_state.doing}'`,
      [task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    res.status(200).json({ success: true, message: "Task has been promoted from Doing to Done successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

// Demote Done to Doing
exports.demoteTask2Doing = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  // checkgroup dynamically for app_permit_...

  const { task_id } = req.body;

  if (!task_id) {
    return res.status(400).json({ message: "Task_ID must be provided." });
  }

  try {
    const [rows] = await pool.execute(
      `UPDATE task SET task_state = '${task_state.doing}' 
      WHERE task_id = ? AND task_state = '${task_state.done}'`,
      [task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

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

  // checkgroup dynamically for app_permit_...

  const { task_id } = req.body;

  if (!task_id) {
    return res.status(400).json({ message: "Task_ID must be provided." });
  }

  try {
    const [rows] = await pool.execute(
      `UPDATE task SET task_state = '${task_state.close}' 
      WHERE task_id = ? AND task_state = '${task_state.done}'`,
      [task_id]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "Invalid Task_ID or Task state." });
    }

    res.status(200).json({ success: true, message: "Task has been promoted from Done to Close successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to promote task." });
  }
};

exports.updateNotes = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  // checkgroup...

  const { task_id, task_notes } = req.body;

  if (!task_id) {
    return res.status(400).json({ message: "Task ID must be provided." });
  }

  try {
    const [rows] = await pool.execute(`UPDATE task SET task_notes = ? WHERE task_id = ?`, [task_notes, task_id]);

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "No update performed or task not found." });
    }

    res.status(200).json({ success: true, message: "Task notes updated successfully." })
  } catch (error) {
    return res.status(500).json({ message: "Failed to update notes." });
  }
};

// Function to get current date
function getCurrentDate() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();

  return `${day}-${month}-${year}`;
}
