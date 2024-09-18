const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const verifyToken = require("../middlewares/verifyToken");

router.get("/user", verifyToken.verifyToken, userController.getUser);
router.get("/users", verifyToken.verifyToken, userController.getUsers);
router.post("/users/create", verifyToken.verifyToken, userController.createUser);
router.patch("/users/disable", verifyToken.verifyToken, userController.disableUser);
router.patch("/users/reset", verifyToken.verifyToken, userController.resetCredentials);
router.patch("/users/update-email", verifyToken.verifyToken, userController.updateEmail);
router.patch("/users/update-password", verifyToken.verifyToken, userController.updatePassword);

module.exports = router;
