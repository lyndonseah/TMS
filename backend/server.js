const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const tmsRoute = require("./routes/tmsRoute");
const errorMiddleware = require("./middlewares/errors");

dotenv.config({ path: "./config/config.env" });

const bodyCode = {
  // Generic success/error
  generalSuccess: "S001", // Success
  generalError: "E001", // Internal Server Error

  // URL
  url1: "U001", // URL don't match

  // Authentication
  auth1: "A001", // Username does not exist or Invalid credentials
  auth2: "A002", // User not active
  auth3: "A003", // Insufficient group permission

  // Payload
  payload1: "P001", // Missing mandatory keys

  // Transaction
  trans1: "T001", // Invalid values
  trans2: "T002", // Value out of range
  trans3: "T003", // Task state error
  trans4: "T004" // Transaction error
};

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:3007",
    credentials: true
  })
);

app.use("/api", tmsRoute);
app.use((req, res) => {
  res.status(400).json({ code: bodyCode.url1 });
});

app.use(errorMiddleware);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server started on port ${process.env.PORT} in mode.`);
});
