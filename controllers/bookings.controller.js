const db = require('../config/db');

// Helper handle lỗi để không phải viết console.error lặp đi lặp lại
const handleError = (res, msg, err) => (console.error(msg, err), res.status(500).json({ message: msg + (err.message ? ': ' + err.message : '') }));

exports.getAll = async (req, res) => {
    try {
        let sql = `SELECT b.*, c.full_name as customer_name, c.phone, r.room_number, r.price as room_price FROM bookings b JOIN customers c ON b.customer_id = c.customer_id JOIN rooms r ON b.room_id = r.room_id`;
        const params = req.user.role === 'customer' ? [req.user.id] : [];
        if (params.length) sql += " WHERE b.customer_id = ?";
        const [bookings] = await db.query(sql + " ORDER BY b.booking_id DESC", params);
        return res.json(bookings);
    } catch (err) { 
        return handleError(res, 'Lỗi khi lấy danh sách đặt phòng', err); 
    }
};

exports.getById = async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT b.*, c.full_name as customer_name, c.email, c.phone, r.room_number, r.price as room_price FROM bookings b JOIN customers c ON b.customer_id = c.customer_id JOIN rooms r ON b.room_id = r.room_id WHERE b.booking_id = ?`, [req.params.id]);
        return rows.length ? res.json(rows[0]) : res.status(404).json({ message: 'Không tìm thấy đặt phòng' });
    } catch (err) { 
        return handleError(res, 'Lỗi khi lấy thông tin đặt phòng', err); 
    }
};

exports.create = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        let { customer_id, room_id, check_in, check_out, total_nights } = req.body;
        if (req.user.role === 'customer') customer_id = req.user.id;

        const [rooms] = await conn.query('SELECT status FROM rooms WHERE room_id = ?', [room_id]);
        if (!rooms.length || rooms[0].status !== 'available') 
            return await conn.rollback(), res.status(400).json({ message: 'Phòng không trống hoặc không tồn tại' 
        });

        total_nights = total_nights || (check_in && check_out ? Math.max(1, Math.ceil((new Date(check_out) - new Date(check_in)) / 86400000)) : 1);

        const [result] = await conn.query(
            `INSERT INTO bookings (customer_id, room_id, check_in, check_out, total_nights, status) 
            VALUES (?, ?, ?, ?, ?, 'booked')`, 
            [customer_id, room_id, check_in, check_out, total_nights]
        );
        await conn.query("UPDATE rooms SET status = 'booked' WHERE room_id = ?", [room_id]);
        
        await conn.commit();
        return res.json({ 
            success: true, 
            message: 'Đặt phòng thành công', 
            booking_id: result.insertId });
    } catch (err) { 
        return await conn.rollback(), 
        handleError(res, 'Lỗi khi đặt phòng', err); 
    } finally { 
        conn.release(); 
    }
};

exports.checkIn = async (req, res) => {
    try {
        const [resB] = await db.query("UPDATE bookings SET status = 'checked_in' WHERE booking_id = ?", [req.params.id]);
        if (!resB.affectedRows) return res.status(404).json({ message: 'Không tìm thấy đặt phòng' });
        await db.query("UPDATE rooms SET status = 'checked_in' WHERE room_id = (SELECT room_id FROM bookings WHERE booking_id = ?)", [req.params.id]);
        return res.json({ 
            success: true, 
            message: 'Check-in thành công' 
        });
    } catch (err) { 
        return handleError(res, 'Lỗi khi check-in', err); 
    }
};

exports.checkOut = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [bookings] = await conn.query(
            `SELECT b.*, r.price as room_price, r.room_id 
            FROM bookings b 
            JOIN rooms r ON b.room_id = r.room_id 
            WHERE b.booking_id = ?`, 
            [req.params.id]
        );
        if (!bookings.length) return await conn.rollback(), res.status(404).json({ message: 'Không tìm thấy đặt phòng' });

        const { room_id, check_in, check_out, total_nights, room_price } = bookings[0];
        const nights = total_nights || Math.max(1, Math.ceil((new Date(check_out || new Date()) - new Date(check_in)) / 86400000));
        const roomAmount = nights * room_price;

        const [services] = await conn.query(
            `SELECT IFNULL(SUM(s.price * bs.quantity), 0) as total 
            FROM booking_services bs 
            JOIN services s ON bs.service_id = s.service_id 
            WHERE bs.booking_id = ?`, 
            [req.params.id]
        );
        const totalAmount = roomAmount + services[0].total;

        await conn.query("UPDATE bookings SET status = 'checked_out' WHERE booking_id = ?", [req.params.id]);
        await conn.query("UPDATE rooms SET status = 'available' WHERE room_id = ?", [room_id]);
        const [invoice] = await conn.query(
            `INSERT INTO invoices (booking_id, room_amount, service_amount, total_amount, status, payment_method) 
            VALUES (?, ?, ?, ?, 'unpaid', ?)`, 
            [req.params.id, roomAmount, services[0].total, totalAmount, req.body.payment_method || null]
        );

        await conn.commit();
        return res.json({ 
            success: true, 
            message: 'Check-out thành công', 
            invoice_id: invoice.insertId, roomAmount, 
            serviceAmount: services[0].total, totalAmount 
        });
    } catch (err) {
        return await conn.rollback(), handleError(res, 'Lỗi khi check-out', err); 
    } finally { 
        conn.release(); 
    }
};

exports.cancel = async (req, res) => {
    try {
        const [bookings] = await db.query(
            'SELECT room_id, status FROM bookings WHERE booking_id = ?', 
            [req.params.id]
        );
        if (!bookings.length) 
            return res.status(404).json({ message: 'Không tìm thấy đặt phòng' 
        });
        if (bookings[0].status !== 'booked') 
            return res.status(400).json({ message: 'Chỉ có thể hủy đặt phòng ở trạng thái đã đặt' 
        });

        await db.query("UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?", [req.params.id]);
        await db.query("UPDATE rooms SET status = 'available' WHERE room_id = ?", [bookings[0].room_id]);
        return res.json({ success: true, message: 'Hủy đặt phòng thành công' });
    } catch (err) { 
        return handleError(res, 'Lỗi khi hủy đặt phòng', err); 
    }
};

exports.remove = async (req, res) => {
    try {
        const [result] = await db.query("DELETE FROM bookings WHERE booking_id = ?", [req.params.id]);
        return result.affectedRows ? res.json({ success: true, message: 'Xóa đặt phòng thành công' }) : res.status(404).json({ message: 'Không tìm thấy đặt phòng' });
    } catch (err) { 
        return handleError(res, 'Lỗi khi xóa đặt phòng', err); 
    }
};