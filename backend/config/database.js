const dotenv = require("dotenv");
dotenv.config({ path: "./config/config.env" });

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_SCHEMA
});

// Test connection
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Database connection successful!");
    connection.release();
  } catch (err) {
    console.error("Error connecting to the database: ", err);
  }
})();

module.exports = pool;
