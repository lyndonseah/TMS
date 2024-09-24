const pool = require("../config/database");
const { checkGroup } = require("./authController");
const { validateDate } = require("../utils/dateCheck");

// Get one app
exports.getApp = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const { app_acronym } = req.body;

  if (!app_acronym) {
    return res.status(400).json({ message: "App_Acronym must be provided." });
  }

  try {
    const [rows] = await pool.execute(`SELECT * FROM application WHERE app_acronym = ?`, [app_acronym]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Application not found." });
    }

    res.status(200).json({ success: true, app: rows[0], message: "Application fetched successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch application." });
  }
};

// Get all apps
exports.getApps = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authenticaton required." });
  }

  try {
    const [rows] = await pool.execute(`SELECT * FROM application`);

    if (rows.length > 0) {
      res.status(200).json({ success: true, rows, message: "Application(s) fetched successfully." });
    } else {
      return res.status(404).json({ message: "No application(s) found." });
    }
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch application(s)." });
  }
};

// Create app
exports.createApp = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const isAuthorized = await checkGroup(req.user.username, ["PL"]);

  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  const { app_acronym, app_description, app_rNumber, app_startDate, app_endDate, app_permitCreate, app_permitOpen, app_permitToDoList, app_permitDoing, app_permitDone } = req.body;

  if (!app_acronym || !app_rNumber || !app_startDate || !app_endDate) {
    return res.status(400).json({ message: "App_Acronym, App_Rnumber, App_Startdate, and App_Enddate are mandatory fields." });
  }

  if (app_rNumber <= 0) {
    return res.status(400).json({ message: "App_Rnumber must be positive integer." });
  }

  if (!validateDate(app_startDate) || !validateDate(app_endDate)) {
    return res.status(400).json({ message: "Date should be in valid DD-MM-YYYY format." });
  }

  try {
    const [acronymRows] = await pool.execute(`SELECT app_acronym FROM application WHERE app_acronym = ?`, [app_acronym]);

    if (acronymRows.length > 0) {
      return res.status(409).json({ message: "App_Acronym already taken." });
    }

    await pool.execute(
      `INSERT INTO application (app_acronym, app_description, app_rNumber, 
      app_startDate, app_endDate, app_permitCreate, app_permitOpen, 
      app_permitToDoList, app_permitDoing, app_permitDone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [app_acronym, app_description || null, app_rNumber, app_startDate, app_endDate, app_permitCreate || null, app_permitOpen || null, app_permitToDoList || null, app_permitDoing || null, app_permitDone || null]
    );

    res.status(201).json({ success: true, message: `Application '${app_acronym}' created successfully.` });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create application." });
  }
};

// Edit app
exports.editApp = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const isAuthorized = await checkGroup(req.user.username, ["PL"]);

  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  const { app_acronym, app_description, app_permitCreate, app_permitOpen, app_permitToDoList, app_permitDoing, app_permitDone } = req.body;

  if (!app_acronym) {
    return res.status(400).json({ message: "App_Acronym must be provided." });
  }

  try {
    const [rows] = await pool.execute(
      `UPDATE application SET app_description = ?, app_permitCreate = ?, app_permitOpen = ?,
      app_permitToDoList= ?, app_permitDoing = ?, app_permitDone = ? WHERE app_acronym = ?`,
      [app_description || null, app_permitCreate || null, app_permitOpen || null, app_permitToDoList || null, app_permitDoing || null, app_permitDone || null, app_acronym]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "No edit performed or application not found." });
    }

    res.status(200).json({ success: true, message: `Application '${app_acronym}' has been edited successfully.` });
  } catch (error) {
    return res.status(500).json({ message: "Failed to edit application." });
  }
};
