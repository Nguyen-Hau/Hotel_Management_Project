const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "123456",
  database: process.env.DB_NAME || "hotel_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Cấu hình sql_mode khi có kết nối mới
pool.on("connection", function (connection) {
  connection.query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))",);
});

const db = pool.promise();

// Hàm kiểm tra kết nối cơ sở dữ liệu
async function testConnection() {
  try {
    await db.query("SELECT 1"); // Thử truy vấn đơn giản để kiểm tra kết nối

    const [[{ count: empCount }]] = await db.query("SELECT COUNT(*) AS count FROM employees");
    const [[{ count: cusCount }]] = await db.query("SELECT COUNT(*) AS count FROM customers");
    const [[{ count: roomCount }]] = await db.query("SELECT COUNT(*) AS count FROM rooms");

    console.log("Ket noi MySQL thanh cong!");
    console.log("So luong nhan vien trong db: ", empCount);
    console.log("So luong khach hang trong db: ", cusCount);
    console.log("So luong phong trong db: ", roomCount);
  } catch (err) {
    console.error("Loi ket noi MySQL:", err);
  }
}

// Chạy hàm kiểm tra
testConnection();

module.exports = db;
