const db = require('../config/db');

// Hàm bổ trợ in lỗi viết dạng function truyền thống
function errRes(res, msg, err) {
    console.error(msg, err);
    let chiTietLoi = '';
    if (err && err.message) {
        chiTietLoi = ': ' + err.message;
    }
    return res.status(500).json({ message: msg + chiTietLoi });
}

// 1. Lấy danh sách đặt phòng
async function getAll(req, res) {
    try {
        let sql = 'SELECT b.*, c.full_name as customer_name, r.room_number, r.price as room_price, r.room_type FROM bookings b JOIN customers c ON b.customer_id = c.customer_id JOIN rooms r ON b.room_id = r.room_id';
        const params = [];
        
        if (req.user.role === 'customer') {
            params.push(req.user.id);
            sql += ' WHERE b.customer_id = ?';
        }
        
        const [bookings] = await db.query(sql + ' ORDER BY b.booking_id DESC', params);
        
        for (let b of bookings) {
            const [inv] = await db.query('SELECT total_amount FROM invoices WHERE booking_id = ?', [b.booking_id]);
            if (inv.length > 0) {
                b.total_amount = inv[0].total_amount;
            } else {
                b.total_amount = 0;
            }
        }
        return res.json(bookings);
    } catch (err) { 
        return errRes(res, 'Lỗi lấy danh sách đặt phòng', err); 
    }
}

// 2. Lấy chi tiết đặt phòng bằng ID
async function getById(req, res) {
    try {
        const [b] = await db.query('SELECT b.*, c.full_name as customer_name, c.email, c.phone, r.room_number, r.price as room_price, r.room_type FROM bookings b JOIN customers c ON b.customer_id = c.customer_id JOIN rooms r ON b.room_id = r.room_id WHERE b.booking_id = ?', [req.params.id]);
        
        if (b.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng' });
        }
        if (req.user.role === 'customer' && b[0].customer_id !== req.user.id) {
            return res.status(403).json({ message: 'Không có quyền xem thông tin này' });
        }
        return res.json(b[0]);
    } catch (err) { 
        return errRes(res, 'Lỗi lấy chi tiết đặt phòng', err); 
    }
}

// 3. Tạo đơn đặt phòng mới
async function create(req, res) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        let room_id = req.body.room_id;
        let check_in = req.body.check_in;
        let check_out = req.body.check_out;
        
        let customer_id = req.body.customer_id;
        if (req.user.role === 'customer') {
            customer_id = req.user.id;
        }

        if (!customer_id) {
            await conn.rollback();
            return res.status(400).json({ message: 'Thiếu thông tin khách hàng' });
        }

        const [rm] = await conn.query('SELECT status, room_number FROM rooms WHERE room_id = ?', [room_id]);
        if (rm.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Phòng không tồn tại' });
        }
        if (rm[0].status !== 'available') {
            await conn.rollback();
            return res.status(400).json({ message: 'Phòng ' + rm[0].room_number + ' đang bận' });
        }

        let nights = null;
        if (check_in && check_out) {
            nights = Math.max(1, Math.ceil((new Date(check_out) - new Date(check_in)) / 86400000));
        }

        const [r] = await conn.query('INSERT INTO bookings (customer_id, room_id, check_in, check_out, total_nights, status) VALUES (?, ?, ?, ?, ?, "booked")', [customer_id, room_id, check_in, check_out || null, nights]);
        await conn.query('UPDATE rooms SET status = "booked" WHERE room_id = ?', [room_id]);
        
        await conn.commit();
        return res.json({ success: true, message: 'Đặt phòng thành công', booking_id: r.insertId });
    } catch (err) { 
        await conn.rollback(); 
        return errRes(res, 'Lỗi khi đặt phòng', err); 
    } finally { 
        conn.release(); 
    }
}

// 4. Xử lý Check-in nhận phòng
async function checkIn(req, res) {
    try {
        const [b] = await db.query('SELECT room_id, status FROM bookings WHERE booking_id = ?', [req.params.id]);
        if (b.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng' });
        }
        if (b[0].status !== 'booked') {
            return res.status(400).json({ message: 'Không thể check-in phòng này (trạng thái sai)' });
        }

        await db.query('UPDATE bookings SET status = "checked_in" WHERE booking_id = ?', [req.params.id]);
        await db.query('UPDATE rooms SET status = "checked_in" WHERE room_id = ?', [b[0].room_id]);
        return res.json({ success: true, message: 'Check-in thành công' });
    } catch (err) { 
        return errRes(res, 'Lỗi thực hiện check-in', err); 
    }
}

// 5. Xử lý Check-out trả phòng & Tính hóa đơn
async function checkOut(req, res) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [b] = await conn.query('SELECT b.*, r.price as room_price, r.room_id FROM bookings b JOIN rooms r ON b.room_id = r.room_id WHERE b.booking_id = ?', [req.params.id]);
        
        if (b.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng' });
        }
        if (b[0].status !== 'checked_in') {
            await conn.rollback();
            return res.status(400).json({ message: 'Chỉ có thể check-out phòng đang ở' });
        }

        let nights = b[0].total_nights;
        if (!nights) {
            let outDate = b[0].check_out ? new Date(b[0].check_out) : new Date();
            nights = Math.max(1, Math.ceil((outDate - new Date(b[0].check_in)) / 86400000));
        }

        const [svs] = await conn.query('SELECT IFNULL(SUM(s.price * bs.quantity), 0) as total FROM booking_services bs JOIN services s ON bs.service_id = s.service_id WHERE bs.booking_id = ?', [req.params.id]);
        
        let rmAmt = nights * b[0].room_price;
        let svAmt = Number(svs[0].total);
        let total = rmAmt + svAmt;

        await conn.query('UPDATE bookings SET status = "checked_out", total_nights = ? WHERE booking_id = ?', [nights, req.params.id]);
        await conn.query('UPDATE rooms SET status = "available" WHERE room_id = ?', [b[0].room_id]);

        const [existInv] = await conn.query('SELECT invoice_id FROM invoices WHERE booking_id = ?', [req.params.id]);
        let invId = null;
        if (existInv.length > 0) {
            invId = existInv[0].invoice_id;
            await conn.query('UPDATE invoices SET room_amount = ?, service_amount = ?, total_amount = ? WHERE booking_id = ?', [rmAmt, svAmt, total, req.params.id]);
        } else {
            const [insertRes] = await conn.query('INSERT INTO invoices (booking_id, room_amount, service_amount, total_amount, status) VALUES (?, ?, ?, ?, "unpaid")', [req.params.id, rmAmt, svAmt, total]);
            invId = insertRes.insertId;
        }

        await conn.commit();
        return res.json({ success: true, message: 'Check-out thành công', invoice_id: invId, total: total });
    } catch (err) { 
        await conn.rollback(); 
        return errRes(res, 'Lỗi khi thực hiện check-out', err); 
    } finally { 
        conn.release(); 
    }
}

// 6. Hủy đơn đặt phòng
async function cancel(req, res) {
    try {
        const [b] = await db.query('SELECT room_id, status, customer_id FROM bookings WHERE booking_id = ?', [req.params.id]);
        if (b.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng' });
        }
        if (req.user.role === 'customer' && b[0].customer_id !== req.user.id) {
            return res.status(403).json({ message: 'Không có quyền hủy phòng của người khác' });
        }
        if (b[0].status !== 'booked') {
            return res.status(400).json({ message: 'Chỉ được phép hủy phòng khi đang ở trạng thái đã đặt' });
        }

        await db.query('UPDATE bookings SET status = "cancelled" WHERE booking_id = ?', [req.params.id]);
        await db.query('UPDATE rooms SET status = "available" WHERE room_id = ?', [b[0].room_id]);
        return res.json({ success: true, message: 'Hủy đặt phòng thành công' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi hủy đặt phòng', err); 
    }
}

// Đồng bộ xuất module giống hoàn toàn file users.controller.js
module.exports = {
    getAll,
    getById,
    create,
    checkIn,
    checkOut,
    cancel
};