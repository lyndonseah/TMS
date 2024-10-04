const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const groupController = require("../controllers/groupController");
const appController = require("../controllers/appController");
const planController = require("../controllers/planController");
const taskController = require("../controllers/taskController");
const verifyToken = require("../middlewares/verifyToken");

// Assignment 3
const createTaskController = require("../controllers/createTaskController");
const getTaskController = require("../controllers/getTaskController");
const promoteTaskController = require("../controllers/promoteTaskController");

// Authentication Routes
router.post("/login", authController.login);
router.get("/logout", authController.logout);

// User Controller Routes
router.get("/user", verifyToken.verifyTokenAccess, userController.getUser);
router.get("/users", verifyToken.verifyTokenAccess, userController.getUsers);
router.post("/users/create", verifyToken.verifyTokenAccess, userController.createUser);
router.patch("/users/update-status", verifyToken.verifyTokenAccess, userController.updateUserStatus);
router.patch("/users/reset", verifyToken.verifyTokenAccess, userController.resetCredentials);
router.patch("/users/update-email", verifyToken.verifyTokenAccess, userController.updateEmail);
router.patch("/users/update-password", verifyToken.verifyTokenAccess, userController.updatePassword);

// Group Controller Routes
router.post("/group", verifyToken.verifyTokenAccess, groupController.getUserGroup);
router.get("/group/own", verifyToken.verifyTokenAccess, groupController.getOwnGroup);
router.get("/groups", verifyToken.verifyTokenAccess, groupController.getGroups);
router.post("/groups/create", verifyToken.verifyTokenAccess, groupController.createGroup);
router.patch("/groups/assign", verifyToken.verifyTokenAccess, groupController.assignGroup);

// App Controller Routes
// router.post("/app", verifyToken.verifyTokenAccess, appController.getApp);
router.get("/apps", verifyToken.verifyTokenAccess, appController.getApps);
router.post("/apps/permit", verifyToken.verifyTokenAccess, appController.getPermitGroups);
router.post("/apps/create", verifyToken.verifyTokenAccess, appController.createApp);
router.patch("/apps/edit", verifyToken.verifyTokenAccess, appController.editApp);

// Plan Controller Routes
// router.post("/plan", verifyToken.verifyTokenAccess, planController.getPlan);
router.post("/plans", verifyToken.verifyTokenAccess, planController.getPlans);
router.post("/plans/create", verifyToken.verifyTokenAccess, planController.createPlan);
router.patch("/plans/edit", verifyToken.verifyTokenAccess, planController.editPlan);

// Task Controller Routes
// router.post("/task", verifyToken.verifyTokenAccess, taskController.getTask);
router.post("/tasks", verifyToken.verifyTokenAccess, taskController.getTasksByState);
router.post("/tasks/create", verifyToken.verifyTokenAccess, taskController.createTask);
router.patch("/tasks/promote-open-todo", verifyToken.verifyTokenAccess, taskController.promoteTask2ToDo);
router.patch("/tasks/promote-todo-doing", verifyToken.verifyTokenAccess, taskController.promoteTask2Doing);
router.patch("/tasks/demote-doing-todo", verifyToken.verifyTokenAccess, taskController.demoteTask2ToDo);
router.patch("/tasks/promote-doing-done", verifyToken.verifyTokenAccess, taskController.promoteTask2Done);
router.patch("/tasks/promote-done-close", verifyToken.verifyTokenAccess, taskController.promoteTask2Close);
router.patch("/tasks/demote-done-doing", verifyToken.verifyTokenAccess, taskController.demoteTask2Doing);
router.patch("/tasks/update-plan", verifyToken.verifyTokenAccess, taskController.updateTaskPlan);
router.patch("/tasks/update-notes", verifyToken.verifyTokenAccess, taskController.updateNotes);

// Assignment 3 controller
router.post("/task/createTask", createTaskController.createTask);
router.post("/task/getTaskByState", getTaskController.getTaskByState);
router.post("/task/promoteTask2Done", promoteTaskController.promoteTask2Done);

module.exports = router;
