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
        let room_ids = req.body.room_ids;
        if (!Array.isArray(room_ids)) {
            room_ids = req.body.room_id ? [req.body.room_id] : [];
        }

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

        if (room_ids.length === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Vui lòng chọn ít nhất một phòng' });
        }

        // Validate and check overlaps for all selected rooms
        const queryCheckOut = check_out || new Date(new Date(check_in).getTime() + 86400000).toISOString().split('T')[0];

        for (let r_id of room_ids) {
            const [rm] = await conn.query('SELECT status, room_number FROM rooms WHERE room_id = ?', [r_id]);
            if (rm.length === 0) {
                await conn.rollback();
                return res.status(404).json({ message: 'Phòng không tồn tại' });
            }
            if (rm[0].status === 'maintenance') {
                await conn.rollback();
                return res.status(400).json({ message: 'Phòng ' + rm[0].room_number + ' đang bảo trì' });
            }

            // Kiểm tra trùng lịch đặt phòng (Overlap checking)
            const [overlapping] = await conn.query(
                `SELECT b.booking_id, b.check_in, b.check_out, c.full_name
                 FROM bookings b
                 JOIN customers c ON b.customer_id = c.customer_id
                 WHERE b.room_id = ?
                   AND b.status IN ('booked', 'checked_in')
                   AND IFNULL(b.check_out, DATE_ADD(b.check_in, INTERVAL 1 DAY)) > ?
                   AND b.check_in < ?`,
                [r_id, check_in, queryCheckOut]
            );

            if (overlapping.length > 0) {
                await conn.rollback();
                const formatD = d => new Date(d).toLocaleDateString('vi-VN');
                return res.status(400).json({
                    message: `Phòng ${rm[0].room_number} đã được đặt từ ngày ${formatD(overlapping[0].check_in)} đến ${formatD(overlapping[0].check_out)} bởi khách ${overlapping[0].full_name}`
                });
            }
        }

        let nights = null;
        if (check_in && check_out) {
            nights = Math.max(1, Math.ceil((new Date(check_out) - new Date(check_in)) / 86400000));
        }

        // Generate group id if booking multiple rooms
        const booking_group_id = room_ids.length > 1 ? `GRP-${Date.now()}-${Math.floor(Math.random() * 1000)}` : null;
        let firstInsertedId = null;

        for (let r_id of room_ids) {
            const [r] = await conn.query(
                'INSERT INTO bookings (customer_id, room_id, check_in, check_out, total_nights, status, booking_group_id) VALUES (?, ?, ?, ?, ?, "booked", ?)',
                [customer_id, r_id, check_in, check_out || null, nights, booking_group_id]
            );
            if (!firstInsertedId) firstInsertedId = r.insertId;

            // Cập nhật trạng thái rooms.status chỉ khi ngày check-in bằng hoặc trước hôm nay
            const todayStr = new Date().toISOString().split('T')[0];
            if (check_in <= todayStr && (!check_out || check_out > todayStr)) {
                await conn.query('UPDATE rooms SET status = "booked" WHERE room_id = ?', [r_id]);
            }
        }

        await conn.commit();
        return res.json({ success: true, message: 'Đặt phòng thành công', booking_id: firstInsertedId });
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
        const [b] = await db.query(
            `SELECT b.room_id, b.status, b.booking_group_id, c.customer_id, c.full_name, c.phone, c.cccd 
             FROM bookings b 
             JOIN customers c ON b.customer_id = c.customer_id 
             WHERE b.booking_id = ?`,
            [req.params.id]
        );
        if (b.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng' });
        }
        if (b[0].status !== 'booked') {
            return res.status(400).json({ message: 'Không thể check-in phòng này (trạng thái sai)' });
        }

        const { full_name, phone, cccd, check_in_group } = req.body;
        if (!full_name || !phone || !cccd) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ họ tên, số điện thoại và CCCD để check-in' });
        }

        const cleanStr = s => (s || '').toString().trim().toLowerCase();
        if (cleanStr(b[0].full_name) !== cleanStr(full_name)) {
            return res.status(400).json({ message: 'Họ tên không khớp với thông tin đặt phòng' });
        }
        if (cleanStr(b[0].phone) !== cleanStr(phone)) {
            return res.status(400).json({ message: 'Số điện thoại không khớp với thông tin đặt phòng' });
        }
        if (b[0].cccd && cleanStr(b[0].cccd) !== cleanStr(cccd)) {
            return res.status(400).json({ message: 'CCCD không khớp với thông tin đặt phòng đã lưu' });
        }

        // Tự động cập nhật CCCD của khách hàng nếu chưa có trong DB
        if (!b[0].cccd) {
            await db.query('UPDATE customers SET cccd = ? WHERE customer_id = ?', [cccd.trim(), b[0].customer_id]);
        }

        if (check_in_group && b[0].booking_group_id) {
            const [gbs] = await db.query('SELECT booking_id, room_id FROM bookings WHERE booking_group_id = ? AND status = "booked"', [b[0].booking_group_id]);
            for (let gb of gbs) {
                await db.query('UPDATE bookings SET status = "checked_in" WHERE booking_id = ?', [gb.booking_id]);
                await db.query('UPDATE rooms SET status = "checked_in" WHERE room_id = ?', [gb.room_id]);
            }
        } else {
            await db.query('UPDATE bookings SET status = "checked_in" WHERE booking_id = ?', [req.params.id]);
            await db.query('UPDATE rooms SET status = "checked_in" WHERE room_id = ?', [b[0].room_id]);
        }
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

        const checkout_group = req.body.checkout_group;
        let bookingsToCheckOut = [b[0]];

        if (checkout_group && b[0].booking_group_id) {
            const [gbs] = await conn.query(
                'SELECT b.*, r.price as room_price, r.room_id FROM bookings b JOIN rooms r ON b.room_id = r.room_id WHERE b.booking_group_id = ? AND b.status = "checked_in"',
                [b[0].booking_group_id]
            );
            if (gbs.length > 0) {
                bookingsToCheckOut = gbs;
            }
        }

        let totalGroupAmount = 0;
        let invoiceIds = [];

        for (let booking of bookingsToCheckOut) {
            let nights = booking.total_nights;
            if (!nights) {
                let outDate = booking.check_out ? new Date(booking.check_out) : new Date();
                nights = Math.max(1, Math.ceil((outDate - new Date(booking.check_in)) / 86400000));
            }

            const [svs] = await conn.query('SELECT IFNULL(SUM(s.price * bs.quantity), 0) as total FROM booking_services bs JOIN services s ON bs.service_id = s.service_id WHERE bs.booking_id = ?', [booking.booking_id]);

            let rmAmt = nights * booking.room_price;
            let svAmt = Number(svs[0].total);
            let total = rmAmt + svAmt;
            totalGroupAmount += total;

            await conn.query('UPDATE bookings SET status = "checked_out", total_nights = ? WHERE booking_id = ?', [nights, booking.booking_id]);
            await conn.query('UPDATE rooms SET status = "available" WHERE room_id = ?', [booking.room_id]);

            const [existInv] = await conn.query('SELECT invoice_id FROM invoices WHERE booking_id = ?', [booking.booking_id]);
            let invId = null;
            if (existInv.length > 0) {
                invId = existInv[0].invoice_id;
                await conn.query('UPDATE invoices SET room_amount = ?, service_amount = ?, total_amount = ? WHERE booking_id = ?', [rmAmt, svAmt, total, booking.booking_id]);
            } else {
                const [insertRes] = await conn.query('INSERT INTO invoices (booking_id, room_amount, service_amount, total_amount, status) VALUES (?, ?, ?, ?, "unpaid")', [booking.booking_id, rmAmt, svAmt, total]);
                invId = insertRes.insertId;
            }
            invoiceIds.push(invId);
        }

        await conn.commit();
        return res.json({
            success: true,
            message: 'Check-out thành công',
            invoice_id: invoiceIds[0],
            invoice_ids: invoiceIds,
            total: totalGroupAmount
        });
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

// 7. Gia hạn ngày check-out đặt phòng (Extend Booking)
async function extend(req, res) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const bookingId = req.params.id;
        const new_check_out = req.body.new_check_out;

        if (!new_check_out) {
            await conn.rollback();
            return res.status(400).json({ message: 'Thiếu ngày check-out mới' });
        }

        const [b] = await conn.query(
            'SELECT b.*, r.room_number FROM bookings b JOIN rooms r ON b.room_id = r.room_id WHERE b.booking_id = ?',
            [bookingId]
        );

        if (b.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy đặt phòng' });
        }

        const booking = b[0];

        if (booking.status !== 'booked' && booking.status !== 'checked_in') {
            await conn.rollback();
            return res.status(400).json({ message: 'Chỉ có thể gia hạn khi phòng chưa check-out' });
        }

        if (req.user.role === 'customer' && booking.customer_id !== req.user.id) {
            await conn.rollback();
            return res.status(403).json({ message: 'Không có quyền thực hiện' });
        }

        const checkInDate = new Date(booking.check_in);
        const originalCheckOutDate = booking.check_out ? new Date(booking.check_out) : new Date(checkInDate.getTime() + 86400000);
        const newCheckOutDate = new Date(new_check_out);

        if (newCheckOutDate <= checkInDate) {
            await conn.rollback();
            return res.status(400).json({ message: 'Ngày check-out mới phải sau ngày nhận phòng' });
        }
        if (newCheckOutDate <= originalCheckOutDate) {
            await conn.rollback();
            return res.status(400).json({ message: 'Ngày check-out mới phải sau ngày check-out hiện tại' });
        }

        // Kiểm tra trùng lịch đặt phòng (Overlap checking) cho khoảng thời gian mới
        const [overlapping] = await conn.query(
            `SELECT b.booking_id, b.check_in, b.check_out, c.full_name
             FROM bookings b
             JOIN customers c ON b.customer_id = c.customer_id
             WHERE b.room_id = ?
               AND b.booking_id != ?
               AND b.status IN ('booked', 'checked_in')
               AND IFNULL(b.check_out, DATE_ADD(b.check_in, INTERVAL 1 DAY)) > ?
               AND b.check_in < ?`,
            [booking.room_id, bookingId, booking.check_out, new_check_out]
        );

        if (overlapping.length > 0) {
            await conn.rollback();
            const formatD = d => new Date(d).toLocaleDateString('vi-VN');
            return res.status(400).json({
                message: `Phòng ${booking.room_number} đã được đặt tiếp từ ngày ${formatD(overlapping[0].check_in)} đến ${formatD(overlapping[0].check_out)} bởi khách ${overlapping[0].full_name}. Không thể gia hạn.`
            });
        }

        const nights = Math.max(1, Math.ceil((newCheckOutDate - checkInDate) / 86400000));
        await conn.query(
            'UPDATE bookings SET check_out = ?, total_nights = ? WHERE booking_id = ?',
            [new_check_out, nights, bookingId]
        );

        await conn.commit();
        return res.json({ success: true, message: 'Gia hạn phòng thành công', new_check_out, total_nights: nights });
    } catch (err) {
        await conn.rollback();
        return errRes(res, 'Lỗi khi gia hạn đặt phòng', err);
    } finally {
        conn.release();
    }
}

module.exports = {
    getAll,
    getById,
    create,
    checkIn,
    checkOut,
    cancel,
    extend
};