const pool = require("../config/database");
const { checkGroup } = require("./authController");
const { validateDate } = require("../utils/dateCheck");

// Get one plan
exports.functionName = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const isAuthorized = await checkGroup(req.user.username, ["PL", "PM"]);

  if (!isAuthorized) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }

  try {
  } catch (error) {}
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

// Edit plan
