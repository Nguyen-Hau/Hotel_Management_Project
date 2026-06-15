const router = require('express').Router(), { verifyToken, ROLES, requireRole } = require('../middleware/auth'), db = require('../config/db');

const errRes = (res, err) => res.status(500).json({ message: err.message }), checkAdmin = requireRole(ROLES.ADMIN);

const usersController = {
    getAllUsers: async (req, res) => {
        try { return res.json((await db.query('SELECT employee_id, full_name, username, role, created_at FROM employees ORDER BY employee_id DESC'))[0]); } 
        catch (err) { return errRes(res, err); }
    },
    createUser: async (req, res) => {
        try {
            const [r] = await db.query('INSERT INTO employees (full_name, username, password, role) VALUES (?, ?, ?, ?)', [req.body.full_name, req.body.username, req.body.password, req.body.role]);
            return res.json({ success: true, message: 'Thêm thành công', userId: r.insertId });
        } catch (err) { return errRes(res, err); }
    },
    updateUser: async (req, res) => {
        try {
            const { full_name, username, role, password } = req.body;
            const sql = password ? 'UPDATE employees SET full_name=?, username=?, role=?, password=? WHERE employee_id=?' : 'UPDATE employees SET full_name=?, username=?, role=? WHERE employee_id=?';
            const params = password ? [full_name, username, role, password, req.params.id] : [full_name, username, role, req.params.id];
            await db.query(sql, params);
            return res.json({ success: true, message: 'Cập nhật thành công' });
        } catch (err) { return errRes(res, err); }
    },
    deleteUser: async (req, res) => {
        try {
            await db.query('DELETE FROM employees WHERE employee_id=?', [req.params.id]);
            return res.json({ success: true, message: 'Xóa thành công' });
        } catch (err) { return errRes(res, err); }
    },
    getUserById: async (req, res) => {
        try {
            const [u] = await db.query('SELECT employee_id, full_name, username, role FROM employees WHERE employee_id=?', [req.params.id]);
            return u.length ? res.json(u[0]) : res.status(404).json({ message: 'Không tìm thấy' });
        } catch (err) { return errRes(res, err); }
    }
};

// ==================== ROUTES ====================
router.get('/', verifyToken, checkAdmin, usersController.getAllUsers);
router.get('/:id', verifyToken, checkAdmin, usersController.getUserById);
router.post('/', verifyToken, checkAdmin, usersController.createUser);
router.put('/:id', verifyToken, checkAdmin, usersController.updateUser);
router.delete('/:id', verifyToken, checkAdmin, usersController.deleteUser);

module.exports = router;