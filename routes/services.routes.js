const router = require('express').Router(), { verifyToken, ROLES, requireRole } = require('../middleware/auth'), db = require('../config/db');

const errRes = (res, err) => res.status(500).json({ message: err.message }), checkStaff = requireRole(ROLES.STAFF);

// ==================== CONTROLLERS ====================
const getAll = async (req, res) => {
    try { return res.json((await db.query('SELECT * FROM services ORDER BY service_id'))[0]); } 
    catch (err) { return errRes(res, err); }
};

const create = async (req, res) => {
    try {
        const [r] = await db.query('INSERT INTO services (service_name, price) VALUES (?, ?)', [req.body.service_name, req.body.price]);
        return res.json({ success: true, message: 'Thêm thành công', id: r.insertId });
    } catch (err) { return errRes(res, err); }
};

const update = async (req, res) => {
    try {
        await db.query('UPDATE services SET service_name=?, price=? WHERE service_id=?', [req.body.service_name, req.body.price, req.params.id]);
        return res.json({ success: true, message: 'Cập nhật thành công' });
    } catch (err) { return errRes(res, err); }
};

const remove = async (req, res) => {
    try {
        await db.query('DELETE FROM services WHERE service_id=?', [req.params.id]);
        return res.json({ success: true, message: 'Xóa thành công' });
    } catch (err) { return errRes(res, err); }
};

const addToBooking = async (req, res) => {
    try {
        const { booking_id, service_id, quantity, appointment_time } = req.body;
        const [sv] = await db.query('SELECT price FROM services WHERE service_id=?', [service_id]);
        const [r] = await db.query('INSERT INTO booking_services (booking_id, service_id, quantity, price, appointment_time) VALUES (?, ?, ?, ?, ?)', [booking_id, service_id, quantity || 1, sv[0].price, appointment_time || null]);
        return res.json({ success: true, message: 'Thêm dịch vụ thành công', id: r.insertId });
    } catch (err) { return errRes(res, err); }
};

const getByBooking = async (req, res) => {
    try { return res.json((await db.query('SELECT bs.*, s.service_name, s.price, (s.price * bs.quantity) as total FROM booking_services bs JOIN services s ON bs.service_id = s.service_id WHERE bs.booking_id = ?', [req.params.booking_id]))[0]); } 
    catch (err) { return errRes(res, err); }
};

const removeFromBooking = async (req, res) => {
    try {
        await db.query('DELETE FROM booking_services WHERE id = ?', [req.params.id]);
        return res.json({ success: true, message: 'Xóa thành công' });
    } catch (err) { return errRes(res, err); }
};

// ==================== ROUTES ====================
router.get('/', verifyToken, checkStaff, getAll);
router.post('/', verifyToken, checkStaff, create);
router.put('/:id', verifyToken, checkStaff, update);
router.delete('/:id', verifyToken, requireRole(ROLES.ADMIN), remove);
router.post('/booking', verifyToken, checkStaff, addToBooking);
router.get('/booking/:booking_id', verifyToken, checkStaff, getByBooking);
router.delete('/booking/:id', verifyToken, checkStaff, removeFromBooking);

module.exports = router;