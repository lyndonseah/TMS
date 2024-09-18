const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const verifyToken = require("../middlewares/verifyToken");

router.post("/group", verifyToken.verifyToken, groupController.getUserGroup);
router.get("/groups", verifyToken.verifyToken, groupController.getGroups);
router.post("/groups/create", verifyToken.verifyToken, groupController.createGroup);
router.patch("/groups/assign", verifyToken.verifyToken, groupController.assignGroup);

module.exports = router;
