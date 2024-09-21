const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const groupController = require("../controllers/groupController");
const appController = require("../controllers/appController");
const verifyToken = require("../middlewares/verifyToken");

// Authentication Routes
router.post("/login", authController.login);
router.get("/logout", authController.logout);

// User Controller Routes
router.get("/user", verifyToken.verifyTokenAccess, userController.getUser);
router.get("/users", verifyToken.verifyTokenAccess, userController.getUsers);
router.post("/users/create", verifyToken.verifyTokenAccess, userController.createUser);
router.patch("/users/disable", verifyToken.verifyTokenAccess, userController.disableUser);
router.patch("/users/reset", verifyToken.verifyTokenAccess, userController.resetCredentials);
router.patch("/users/update-email", verifyToken.verifyTokenAccess, userController.updateEmail);
router.patch("/users/update-password", verifyToken.verifyTokenAccess, userController.updatePassword);

// Group Controller Routes
router.post("/group", verifyToken.verifyTokenAccess, groupController.getUserGroup);
router.get("/groups", verifyToken.verifyTokenAccess, groupController.getGroups);
router.post("/groups/create", verifyToken.verifyTokenAccess, groupController.createGroup);
router.patch("/groups/assign", verifyToken.verifyTokenAccess, groupController.assignGroup);

// App Controller Routes
router.post("/app", verifyToken.verifyTokenAccess, appController.getApp);
router.get("/apps", verifyToken.verifyTokenAccess, appController.getApps);
router.post("/apps/create", verifyToken.verifyTokenAccess, appController.createApp);
router.patch("/apps/edit", verifyToken.verifyTokenAccess, appController.editApp);

module.exports = router;
