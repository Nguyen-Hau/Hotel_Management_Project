const router = require('express').Router();
const { verifyToken, ROLES, requireRole } = require('../middleware/auth');

const employeesController = {
    getAll: async (req, res) => {
        const db = require('../config/db');
        try {
            const [employees] = await db.query('SELECT employee_id, full_name, username, role FROM employees');
            res.json(employees);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
};

router.get('/', verifyToken, requireRole(ROLES.ADMIN), employeesController.getAll);

module.exports = router;