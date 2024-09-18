const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const userRoute = require("./routes/userRoute");
const groupRoute = require("./routes/groupRoute");
const authRoute = require("./routes/authRoute");
const errorMiddleware = require("./middlewares/errors");

dotenv.config({ path: "./config/config.env" });

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true
  })
);

app.use("/api", userRoute);
app.use("/api", groupRoute);
app.use("/api", authRoute);

app.use(errorMiddleware);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server started on port ${process.env.PORT} in ${process.env.NODE_ENV} mode.`);
});
