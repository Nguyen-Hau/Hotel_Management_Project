const router = require('express').Router(), { verifyToken, ROLES, requireRole } = require('../middleware/auth'), db = require('../config/db');

const errRes = (res, msg, err) => (console.error(msg, err), res.status(500).json({ message: msg + (err?.message ? ': ' + err.message : '') }));
const authRoles = requireRole([...ROLES.STAFF, ...ROLES.CUSTOMER]);

// ==================== CONTROLLERS ====================
const getAll = async (req, res) => {
    try {
        let sql = 'SELECT b.*, c.full_name as customer_name, r.room_number, r.price as room_price, r.room_type FROM bookings b JOIN customers c ON b.customer_id = c.customer_id JOIN rooms r ON b.room_id = r.room_id';
        const params = req.user.role === 'customer' ? [req.user.id] : [];
        if (params.length) sql += ' WHERE b.customer_id = ?';
        
        const [bookings] = await db.query(sql + ' ORDER BY b.booking_id DESC', params);
        for (let b of bookings) {
            const [inv] = await db.query('SELECT total_amount FROM invoices WHERE booking_id = ?', [b.booking_id]);
            b.total_amount = inv[0]?.total_amount || 0;
        }
        return res.json(bookings);
    } catch (err) { return errRes(res, 'Lỗi lấy danh sách đặt phòng', err); }
};

const getById = async (req, res) => {
    try {
        const [b] = await db.query('SELECT b.*, c.full_name as customer_name, c.email, c.phone, r.room_number, r.price as room_price, r.room_type FROM bookings b JOIN customers c ON b.customer_id = c.customer_id JOIN rooms r ON b.room_id = r.room_id WHERE b.booking_id = ?', [req.params.id]);
        if (!b.length) return res.status(404).json({ message: 'Không tìm thấy' });
        if (req.user.role === 'customer' && b[0].customer_id !== req.user.id) return res.status(403).json({ message: 'Không có quyền xem booking này' });
        return res.json(b[0]);
    } catch (err) { return errRes(res, err.message); }
};

const create = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        let { customer_id, room_id, check_in, check_out } = req.body;
        if (req.user.role === 'customer') customer_id = req.user.id;
        if (!customer_id) return (await conn.rollback(), res.status(400).json({ message: 'Thiếu thông tin khách hàng' }));

        const [rm] = await conn.query('SELECT status, room_number FROM rooms WHERE room_id = ?', [room_id]);
        if (!rm.length) return (await conn.rollback(), res.status(404).json({ message: 'Phòng không tồn tại' }));
        if (rm[0].status !== 'available') return (await conn.rollback(), res.status(400).json({ message: `Phòng ${rm[0].room_number} không trống. Trạng thái: ${rm[0].status}` }));

        const [ct] = await conn.query('SELECT full_name FROM customers WHERE customer_id = ?', [customer_id]);
        if (!ct.length) return (await conn.rollback(), res.status(404).json({ message: 'Khách hàng không tồn tại' }));

        const nights = check_in && check_out ? Math.max(1, Math.ceil((new Date(check_out) - new Date(check_in)) / 86400000)) : null;
        const [r] = await conn.query('INSERT INTO bookings (customer_id, room_id, check_in, check_out, total_nights, status) VALUES (?, ?, ?, ?, ?, "booked")', [customer_id, room_id, check_in, check_out || null, nights]);
        await conn.query('UPDATE rooms SET status = "booked" WHERE room_id = ?', [room_id]);
        
        await conn.commit();
        return res.json({ success: true, message: 'Đặt phòng thành công', booking_id: r.insertId });
    } catch (err) { return (await conn.rollback(), errRes(res, 'Lỗi khi đặt phòng', err)); } finally { conn.release(); }
};

const checkIn = async (req, res) => {
    try {
        const [b] = await db.query('SELECT room_id, status FROM bookings WHERE booking_id = ?', [req.params.id]);
        if (!b.length) return res.status(404).json({ message: 'Không tìm thấy booking' });
        if (b[0].status !== 'booked') return res.status(400).json({ message: 'Chỉ có thể check-in booking ở trạng thái đã đặt' });

        await db.query('UPDATE bookings SET status = "checked_in" WHERE booking_id = ?', [req.params.id]);
        await db.query('UPDATE rooms SET status = "checked_in" WHERE room_id = ?', [b[0].room_id]);
        return res.json({ success: true, message: 'Check-in thành công' });
    } catch (err) { return errRes(res, err.message); }
};

const checkOut = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [b] = await conn.query('SELECT b.*, r.price as room_price, r.room_id FROM bookings b JOIN rooms r ON b.room_id = r.room_id WHERE b.booking_id = ?', [req.params.id]);
        if (!b.length) return (await conn.rollback(), res.status(404).json({ message: 'Không tìm thấy booking' }));
        if (b[0].status !== 'checked_in') return (await conn.rollback(), res.status(400).json({ message: 'Chỉ có thể check-out booking ở trạng thái đã nhận phòng' }));

        const nights = b[0].total_nights || (b[0].check_in ? Math.max(1, Math.ceil(((b[0].check_out ? new Date(b[0].check_out) : new Date()) - new Date(b[0].check_in)) / 86400000)) : 1);
        const [svs] = await conn.query('SELECT IFNULL(SUM(s.price * bs.quantity), 0) as total FROM booking_services bs JOIN services s ON bs.service_id = s.service_id WHERE bs.booking_id = ?', [req.params.id]);
        
        const rmAmt = nights * b[0].room_price, svAmt = Number(svs[0].total), total = rmAmt + svAmt;

        await conn.query('UPDATE bookings SET status = "checked_out", total_nights = ? WHERE booking_id = ?', [nights, req.params.id]);
        await conn.query('UPDATE rooms SET status = "available" WHERE room_id = ?', [b[0].room_id]);

        const [existInv] = await conn.query('SELECT invoice_id FROM invoices WHERE booking_id = ?', [req.params.id]);
        let invId = existInv[0]?.invoice_id;
        if (invId) await conn.query('UPDATE invoices SET room_amount = ?, service_amount = ?, total_amount = ? WHERE booking_id = ?', [rmAmt, svAmt, total, req.params.id]);
        else invId = (await conn.query('INSERT INTO invoices (booking_id, room_amount, service_amount, total_amount, status) VALUES (?, ?, ?, ?, "unpaid")', [req.params.id, rmAmt, svAmt, total]))[0].insertId;

        await conn.commit();
        return res.json({ success: true, message: 'Check-out thành công', invoice_id: invId, roomAmount: rmAmt, serviceAmount: svAmt, total });
    } catch (err) { return (await conn.rollback(), errRes(res, 'Lỗi khi check-out', err)); } finally { conn.release(); }
};

const cancel = async (req, res) => {
    try {
        const [b] = await db.query('SELECT room_id, status, customer_id FROM bookings WHERE booking_id = ?', [req.params.id]);
        if (!b.length) return res.status(404).json({ message: 'Không tìm thấy booking' });
        if (req.user.role === 'customer' && b[0].customer_id !== req.user.id) return res.status(403).json({ message: 'Không có quyền hủy booking này' });
        if (b[0].status !== 'booked') return res.status(400).json({ message: 'Chỉ có thể hủy đặt phòng ở trạng thái đã đặt' });

        await db.query('UPDATE bookings SET status = "cancelled" WHERE booking_id = ?', [req.params.id]);
        await db.query('UPDATE rooms SET status = "available" WHERE room_id = ?', [b[0].room_id]);
        return res.json({ success: true, message: 'Hủy đặt phòng thành công' });
    } catch (err) { return errRes(res, err.message); }
};

// ==================== ROUTES ====================
router.get('/', verifyToken, authRoles, getAll);
router.get('/:id', verifyToken, authRoles, getById);
router.post('/', verifyToken, authRoles, create);
router.put('/checkin/:id', verifyToken, requireRole(ROLES.STAFF), checkIn);
router.put('/checkout/:id', verifyToken, requireRole(ROLES.STAFF), checkOut);
router.put('/cancel/:id', verifyToken, authRoles, cancel);

module.exports = router;