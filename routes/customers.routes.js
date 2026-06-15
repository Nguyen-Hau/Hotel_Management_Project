const router = require('express').Router(), { verifyToken, ROLES, requireRole } = require('../middleware/auth'), db = require('../config/db');

const errRes = (res, err) => (console.error(err), res.status(500).json({ message: err.message }));
const authRoles = requireRole([...ROLES.STAFF, ...ROLES.CUSTOMER]);

// ==================== CONTROLLERS ====================
const getAll = async (req, res) => {
    try {
        let sql = 'SELECT customer_id, full_name, email, phone, cccd, created_at FROM customers';
        const params = req.user.role === 'customer' ? [req.user.id] : [];
        if (params.length) sql += ' WHERE customer_id = ?';
        
        const [rows] = await db.query(sql + ' ORDER BY customer_id DESC', params);
        return res.json(rows);
    } catch (err) { return errRes(res, err); }
};

const getById = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT customer_id, full_name, email, phone, cccd, created_at FROM customers WHERE customer_id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
        if (req.user.role === 'customer' && rows[0].customer_id != req.user.id) return res.status(403).json({ message: 'Không có quyền xem thông tin này' });
        return res.json(rows[0]);
    } catch (err) { return errRes(res, err); }
};

const create = async (req, res) => {
    try {
        const { full_name, email, phone, cccd, password } = req.body;
        const [exist] = await db.query('SELECT 1 FROM customers WHERE email = ? OR phone = ?', [email, phone]);
        if (exist.length) return res.status(400).json({ message: 'Email hoặc số điện thoại đã tồn tại' });

        const [r] = await db.query('INSERT INTO customers (full_name, email, phone, cccd, password, role) VALUES (?, ?, ?, ?, ?, "customer")', [full_name, email, phone, cccd, password || '123456']);
        return res.json({ success: true, message: 'Thêm khách hàng thành công', id: r.insertId });
    } catch (err) { return errRes(res, err); }
};

const update = async (req, res) => {
    try {
        const { full_name, email, phone, cccd, password } = req.body;
        if (req.user.role === 'customer' && req.params.id != req.user.id) return res.status(403).json({ message: 'Không có quyền sửa thông tin này' });

        let sql = 'UPDATE customers SET full_name = ?, email = ?, phone = ?, cccd = ?', params = [full_name, email, phone, cccd];
        if (password) (sql += ', password = ?', params.push(password));

        await db.query(sql + ' WHERE customer_id = ?', [...params, req.params.id]);
        return res.json({ success: true, message: 'Cập nhật khách hàng thành công' });
    } catch (err) { return errRes(res, err); }
};

const remove = async (req, res) => {
    try {
        if (req.user.role !== 'Giám đốc') return res.status(403).json({ message: 'Không có quyền xóa khách hàng' });
        await db.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
        return res.json({ success: true, message: 'Xóa khách hàng thành công' });
    } catch (err) { return errRes(res, err); }
};

// ==================== ROUTES ====================
router.get('/', verifyToken, authRoles, getAll);
router.get('/:id', verifyToken, authRoles, getById);
router.post('/', verifyToken, requireRole(ROLES.STAFF), create);
router.put('/:id', verifyToken, authRoles, update);
router.delete('/:id', verifyToken, requireRole(ROLES.ADMIN), remove);

module.exports = router;