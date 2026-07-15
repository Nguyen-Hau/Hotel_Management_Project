const db = require('../config/db');

const AuthModel = {
    findEmployeeByUsername: async (username) => {
        const [rows] = await db.query("SELECT * FROM employees WHERE username = ?", [username]);
        return rows[0] || null;
    },

    findCustomerByEmailOrPhone: async (username) => {
        const [rows] = await db.query(
            "SELECT * FROM customers WHERE email = ? OR phone = ?", 
            [username, username]
        );
        return rows[0] || null;
    },

    checkCustomerExists: async (email, phone) => {
        const [rows] = await db.query(
            "SELECT 1 FROM customers WHERE email = ? OR phone = ?", 
            [email, phone]
        );
        return rows.length > 0;
    },

    registerCustomer: async (customerData) => {
        const { full_name, email, phone, country, cccd, password } = customerData;
        const [result] = await db.query(
            `INSERT INTO customers (full_name, email, phone, country, cccd, password, role) 
             VALUES (?, ?, ?, ?, ?, ?, 'customer')`,
            [full_name, email, phone, country, cccd || null, password]
        );
        return result.insertId;
    }
};

module.exports = AuthModel;
