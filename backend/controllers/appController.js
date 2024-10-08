const pool = require("../config/database");
const { checkGroup } = require("./authController");
const { parse } = require("date-fns");

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

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const isAuthorized = await checkGroup(req.user.username, ["PROJECT_LEAD"]);

  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  const { app_acronym, app_description, app_rNumber, app_startDate, app_endDate, app_permitCreate, app_permitOpen, app_permitToDoList, app_permitDoing, app_permitDone } = req.body;

  if (!app_acronym || !app_rNumber || !app_startDate || !app_endDate) {
    return res.status(400).json({ message: "App_Acronym, App_Rnumber, App_Startdate, and App_Enddate are mandatory fields." });
  }

  const acronymRegex = /^[A-Za-z0-9_]+$/;
  if (!acronymRegex.test(app_acronym)) {
    return res.status(400).json({ message: "App_Acronym can only be alphanumeric and/or underscores." });
  }

  const app_rNumberNum = Number(app_rNumber);

  if (!Number.isInteger(app_rNumberNum) || app_rNumberNum <= 0) {
    return res.status(400).json({
      message: "App_Rnumber must be a positive integer."
    });
  }

  const parsedStartDate = parse(app_startDate, "dd-MM-yyyy", new Date());
  const parsedEndDate = parse(app_endDate, "dd-MM-yyyy", new Date());

  if (parsedEndDate <= parsedStartDate) {
    return res.status(400).json({ message: "End date must be later than Start date." });
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

  const [isActive] = await pool.execute(`SELECT active FROM users WHERE username = ?`, [req.user.username]);
  if (!isActive[0].active) {
    return res.status(403).json({ message: "You do not have permission, your account was disabled." });
  }

  const isAuthorized = await checkGroup(req.user.username, ["PROJECT_LEAD"]);

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

exports.getPermitGroups = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const { app_acronym } = req.body;

  if (!app_acronym) {
    return res.status(400).json({ message: "App Acronym must be provided." });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT app_permitCreate, app_permitOpen, app_permitToDoList,
      app_permitDoing, app_permitDone FROM application WHERE app_acronym = ?`,
      [app_acronym]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Application not found." });
    }

    const permitGroups = rows[0];
    const permits = {
      app_permitCreate: permitGroups.app_permitCreate || null,
      app_permitOpen: permitGroups.app_permitOpen || null,
      app_permitToDoList: permitGroups.app_permitToDoList || null,
      app_permitDoing: permitGroups.app_permitDoing || null,
      app_permitDone: permitGroups.app_permitDone || null
    };

    res.status(200).json({ success: true, permits, message: "Successfully fetched permit groups." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get permit groups." });
  }
};

// Get one app
// exports.getApp = async (req, res, next) => {
//   if (!req.user) {
//     return res.status(401).json({ message: "Authentication required." });
//   }

//   const { app_acronym } = req.body;

//   if (!app_acronym) {
//     return res.status(400).json({ message: "App_Acronym must be provided." });
//   }

//   try {
//     const [rows] = await pool.execute(`SELECT * FROM application WHERE app_acronym = ?`, [app_acronym]);

//     if (rows.length === 0) {
//       return res.status(404).json({ message: "Application not found." });
//     }

//     res.status(200).json({ success: true, app: rows[0], message: "Application fetched successfully." });
//   } catch (error) {
//     return res.status(500).json({ message: "Failed to fetch application." });
//   }
// };
