const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const tmsRoute = require("./routes/tmsRoute");
// const errorMiddleware = require("./middlewares/errors");

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
  payload2: "P002", // Invalid values
  payload3: "P003", // Value out of range
  payload4: "P004" // Task state error
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

// app.use(errorMiddleware);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server started on port ${process.env.PORT} in ${process.env.NODE_ENV} mode.`);
});
