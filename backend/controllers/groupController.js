const pool = require("../config/database");
const ErrorHandler = require("../utils/errorHandler");
const { checkGroup } = require("./authController");

// Controller to get a user's group
exports.getUserGroup = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAuthorized = await checkGroup(req.user.username, ["Admin"]);

  if (!isAuthorized) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  const { username } = req.body;

  try {
    const [rows] = await pool.execute("SELECT gl.group_name FROM user_group ug JOIN group_list gl ON ug.group_id = gl.group_id WHERE ug.username = ?", [username]);

    if (rows.length === 0) {
      return res.status(200).json({ success: true, groups: [], message: "No groups assigned." });
    }

    const groups = rows.map(row => row.group_name);
    res.status(200).json({ success: true, groups, message: "User's group(s) fetched successfully." });
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch user's group(s).", 500));
  }
};

// Controller to get all groups
exports.getGroups = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAuthorized = await checkGroup(req.user.username, ["Admin"]);

  if (!isAuthorized) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  try {
    const [rows] = await pool.execute("SELECT * FROM group_list");

    if (rows.length > 0) {
      res.status(200).json({ rows, success: true, message: "Group(s) fetched successfully." });
    } else {
      return next(new ErrorHandler("No group(s) found.", 404));
    }
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch group(s).", 500));
  }
};

// Controller to create group
exports.createGroup = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAuthorized = await checkGroup(req.user.username, ["Admin"]);

  if (!isAuthorized) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  const { group_name } = req.body;

  if (!group_name) {
    return res.status(400).json({ message: "Group name cannot be empty." });
  }

  const groupNameRegex = /^[A-Za-z0-9_]+$/;
  if (!groupNameRegex.test(group_name)) {
    return res.status(400).json({ message: "Group name can only be alphanumeric and/or underscores." });
  }

  try {
    const [rows] = await pool.execute("INSERT INTO group_list (group_name) VALUES (?)", [group_name]);
    res.status(201).json({ id: rows.insertId, message: `Group '${group_name}' created successfully.`, success: true });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Group already exists." });
    } else {
      return next(new ErrorHandler("Failed to create group.", 500));
    }
  }
};

// Controller to assign group
exports.assignGroup = async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  const isAuthorized = await checkGroup(req.user.username, ["Admin"]);

  if (!isAuthorized) {
    return next(new ErrorHandler("Access denied. Insufficient permissions.", 403));
  }

  const { username, group_names } = req.body;

  try {
    await pool.query("START TRANSACTION;");

    const [currentGroups] = await pool.query("SELECT group_id FROM user_group WHERE username = ?", [username]);
    const currentGroupIds = new Set(currentGroups.map(group => group.group_id));

    const [allGroups] = await pool.query("SELECT group_id, group_name FROM group_list");
    const groupMap = new Map(allGroups.map(group => [group.group_name, group.group_id]));
    const newGroupIds = new Set(group_names.map(name => groupMap.get(name)));

    const groupsToDelete = [...currentGroupIds].filter(id => !newGroupIds.has(id));
    const groupsToAdd = [...newGroupIds].filter(id => !currentGroupIds.has(id));

    if (groupsToDelete.length > 0) {
      const idsToDelete = groupsToDelete.join(", ");
      await pool.query(`DELETE FROM user_group WHERE username = ? AND group_id IN (${idsToDelete})`, [username]);
    }

    if (groupsToAdd.length > 0) {
      const values = groupsToAdd.map(id => `(${id}, '${username}')`).join(", ");
      await pool.query(`INSERT INTO user_group (group_id, username) VALUES ${values}`);
    }

    await pool.query("COMMIT;");
    res.status(201).json({ message: `User '${username}' has been assigned to group(s) successfully.`, success: true });
  } catch (error) {
    await pool.query("ROLLBACK;");
    return next(new ErrorHandler("Failed to update group assignments, transaction rolled back.", 500));
  }
};
