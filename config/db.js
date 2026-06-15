const mysql = require('mysql2'), 
pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'hotel_db',
    waitForConnections: true, 
    connectionLimit: 10, 
    queueLimit: 0
});

// Tự động cấu hình sql_mode trên 1 dòng
pool.on('connection', connection => 
    connection.query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))")
);

const db = pool.promise();

// Kiểm tra kết nối siêu tốc
(async () => {
    try {
        const [r, emp] = await Promise.all([db.query('SELECT 1'), 
            db.query('SELECT * FROM employees')]);
        console.log(`✅ MySQL connected successfully\n📊 Employees in database: ${emp[0].length}`);
    } catch (err) { 
        console.error('❌ MySQL connection error:', err.message); 
    }
})();

module.exports = db;