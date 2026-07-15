const db = require('../config/db');

const CustomersModel = {
    getAll: async () => {
        const [rows] = await db.query('SELECT customer_id, full_name, email, phone, country, cccd, created_at FROM customers ORDER BY customer_id DESC');
        return rows;
    },

    findById: async (id) => {
        const [rows] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [id]);
        return rows[0] || null;
    },

    create: async (data) => {
        const { full_name, email, phone, country, cccd, password } = data;
        const [result] = await db.query(
            'INSERT INTO customers (full_name, email, phone, country, cccd, password, role) VALUES (?, ?, ?, ?, ?, ?, "customer")', 
            [full_name, email, phone, country, cccd, password]
        );
        return result.insertId;
    },

    update: async (id, data, hasPassword) => {
        const { full_name, email, phone, country, cccd, password } = data;
        let sql = 'UPDATE customers SET full_name = ?, email = ?, phone = ?, country = ?, cccd = ?';
        let params = [full_name, email, phone, country, cccd];
        
        if (hasPassword) {
            sql += ', password = ?';
            params.push(password);
        }
        
        sql += ' WHERE customer_id = ?';
        params.push(id);
        
        const [result] = await db.query(sql, params);
        return result;
    },

    remove: async (id) => {
        const [result] = await db.query('DELETE FROM customers WHERE customer_id = ?', [id]);
        return result.affectedRows;
    }
};

module.exports = CustomersModel;
