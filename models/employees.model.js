const db = require('../config/db');

const EmployeesModel = {
    getAll: async () => {
        const [rows] = await db.query(
            "SELECT employee_id, full_name, username, role, status, created_at FROM employees ORDER BY employee_id DESC"
        );
        return rows;
    },

    findById: async (id) => {
        const [rows] = await db.query(
            "SELECT employee_id, full_name, username, role, status, created_at FROM employees WHERE employee_id = ?",
            [id]
        );
        return rows[0] || null;
    },

    findByUsername: async (username) => {
        const [rows] = await db.query("SELECT * FROM employees WHERE username = ?", [username]);
        return rows[0] || null;
    },

    create: async (data) => {
        const { full_name, username, password, role, status } = data;
        const [result] = await db.query(
            'INSERT INTO employees (full_name, username, password, role, status) VALUES (?, ?, ?, ?, ?)',
            [full_name, username, password, role, status || 'active']
        );
        return result.insertId;
    },

    update: async (id, data, hasPassword) => {
        const { full_name, username, role, status, password } = data;
        let sql = 'UPDATE employees SET full_name = ?, username = ?, role = ?, status = ?';
        let params = [full_name, username, role, status || 'active'];

        if (hasPassword) {
            sql += ', password = ?';
            params.push(password);
        }

        sql += ' WHERE employee_id = ?';
        params.push(id);

        const [result] = await db.query(sql, params);
        return result.affectedRows;
    },

    remove: async (id) => {
        const [result] = await db.query('DELETE FROM employees WHERE employee_id = ?', [id]);
        return result.affectedRows;
    }
};

module.exports = EmployeesModel;
