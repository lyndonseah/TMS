const pool = require("../config/database");
const { checkGroup } = require("./authController");
const { validateDate } = require("../utils/dateCheck");

// Get one plan
exports.getPlan = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const isAuthorized = await checkGroup(req.user.username, ["PL", "PM"]);

  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  const { plan_mvpName, plan_appAcronym } = req.body;

  if (!plan_mvpName || !plan_appAcronym) {
    return res.status(400).json({ message: "Plan_MVP_Name and Plan_App_Acronym must be provided." });
  }

  try {
    const [rows] = await pool.execute(`SELECT * FROM plan WHERE plan_mvpName = ? AND plan_appAcronym = ?`, [plan_mvpName, plan_appAcronym]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Plan_MVP_Name/Plan_App_Acronym not found." });
    }

    res.status(200).json({ success: true, plan: rows[0], message: "Plan fetched successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch plan." });
  }
};

// Get all plans
exports.getPlans = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const isAuthorized = await checkGroup(req.user.username, ["PL", "PM"]);

  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
    const [rows] = await pool.execute(`SELECT * FROM plan`);

    if (rows.length > 0) {
      res.status(200).json({ success: true, rows, message: "Plan(s) fetched successfully." });
    } else {
      return res.status(404).json({ message: "No plan(s) found." });
    }
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch plan(s)." });
  }
};

// Create plan
exports.createPlan = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const isAuthorized = await checkGroup(req.user.username, ["PM"]);

  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  const { plan_mvpName, plan_startDate, plan_endDate, plan_appAcronym, plan_colour } = req.body;

  if (!plan_mvpName || !plan_startDate || !plan_endDate || !plan_appAcronym || !plan_colour) {
    return res.status(400).json({ message: "Plan_MVP_Name, Plan_Startdate, Plan_Enddate, Plan_App_Acronym, and Plan_Colour are mandatory fields." });
  }

  if (!validateDate(plan_startDate) || !validateDate(plan_endDate)) {
    return res.status(400).json({ message: "Date should be in valid DD-MM-YYYY format." });
  }

  try {
    const [acronymRows] = await pool.execute(`SELECT app_acronym FROM application WHERE app_acronym = ?`, [app_acronym]);
    
    if (acronymRows.length === 0) {
      return res.status(404).json({ message: "App_Acronym does not exist." });
    }

    const [plan_app_rows] = await pool.execute(
      `SELECT plan_mvpName, plan_appAcronym FROM plan 
      WHERE plan_mvpName = ? AND plan_appAcronym = ?`,
      [plan_mvpName, plan_appAcronym]
    );

    if (plan_app_rows.length > 0) {
      return res.status(409).json({ message: "Plan_MVP_Name for Plan_App_Acronym already exists." });
    }

    await pool.execute(
      `INSERT INTO plan (plan_mvpName, plan_startDate, plan_endDate, 
      plan_appAcronym, plan_colour) VALUES (?, ?, ?, ?, ?)`,
      [plan_mvpName, plan_startDate, plan_endDate, plan_appAcronym, plan_colour]
    );

    res.status(201).json({ success: true, message: `Plan '${plan_mvpName}' for Application '${plan_appAcronym}' created successfully.` });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create plan." });
  }
};

// Edit plan
exports.editPlan = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const isAuthorized = await checkGroup(req.user.username, ["PM"]);

  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  const { plan_mvpName, plan_startDate, plan_endDate, plan_appAcronym, plan_colour } = req.body;

  if (!plan_mvpName || !plan_startDate || !plan_endDate || !plan_appAcronym || !plan_colour) {
    return res.status(400).json({ message: "Plan_MVP_Name, Plan_Startdate, Plan_Enddate, Plan_App_Acronym, and Plan_Colour are mandatory fields." });
  }

  if (!validateDate(plan_startDate) || !validateDate(plan_endDate)) {
    return res.status(400).json({ message: "Date should be in valid DD-MM-YYYY format." });
  }

  try {
    const [rows] = await pool.execute(
      `UPDATE plan SET plan_startDate = ?, plan_endDate = ?, plan_colour = ?
      WHERE plan_mvpName = ? AND plan_appAcronym = ?`,
      [plan_startDate, plan_endDate, plan_colour, plan_mvpName, plan_appAcronym]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: "No edit performed or plan/app not found." });
    }

    res.status(200).json({ success: true, message: `Plan '${plan_mvpName}' for Application '${plan_appAcronym}' has been edited successfully.` });
  } catch (error) {
    return res.status(500).json({ message: "Failed to edit plan." });
  }
};
