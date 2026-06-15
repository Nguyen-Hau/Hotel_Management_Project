const db = require('../config/db');

// Hàm xử lý lỗi tập trung chạy trên 1 dòng
const errRes = (res, msg, err) => (console.error(msg, err), res.status(500).json({ message: msg }));

// Nhận tất cả các dịch vụ
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM services ORDER BY service_id'
        );
        return res.json(rows);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy danh sách dịch vụ', err); 
    }
};

// Tạo dịch vụ mới
exports.create = async (req, res) => {
    try {
        const [result] = await db.query(
            'INSERT INTO services (service_name, price) VALUES (?, ?)', [req.body.service_name, req.body.price]
        );
        return res.json({ success: true, message: 'Thêm dịch vụ thành công', id: result.insertId });
    } catch (err) { 
        return errRes(res, 'Lỗi khi thêm dịch vụ', err); 
    }
};

// Cập nhật thông tin dịch vụ
exports.update = async (req, res) => {
    try {
        const [r] = await db.query(
            'UPDATE services SET service_name = ?, price = ? WHERE service_id = ?', 
            [req.body.service_name, req.body.price, req.params.id]
        );
        return r.affectedRows ? res.json({ success: true, message: 'Cập nhật dịch vụ thành công' }) : res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi cập nhật dịch vụ', err); 
    }
};

// Xóa dịch vụ khỏi hệ thống
exports.remove = async (req, res) => {
    try {
        const [r] = await db.query(
            'DELETE FROM services WHERE service_id = ?', [req.params.id]
        );
        return r.affectedRows ? res.json({ success: true, 
            message: 'Xóa dịch vụ thành công' }) : res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi xóa dịch vụ', err); 
    }
};

// Thêm dịch vụ vào booking và đặt lịch hẹn
exports.addToBooking = async (req, res) => {
    try {
        const { booking_id, service_id, quantity, appointment_time } = req.body;
        
        const [bk] = await db.query(
            'SELECT 1 FROM bookings WHERE booking_id = ? AND status != "checked_out"', [booking_id]
        );
        if (!bk.length) 
            return res.status(404).json({ message: 'Không tìm thấy đặt phòng hợp lệ' });

        const [sv] = await db.query(
            'SELECT price FROM services WHERE service_id = ?', [service_id]
        );
        if (!sv.length) 
            return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });

        const [r] = await db.query(
            'INSERT INTO booking_services (booking_id, service_id, quantity, price, appointment_time) VALUES (?, ?, ?, ?, ?)', 
            [booking_id, service_id, quantity || 1, sv[0].price, appointment_time || null]
        );
        return res.json({ 
            success: true, 
            message: 'Đã thêm dịch vụ và đặt lịch hẹn thành công', id: r.insertId 
        });
    } catch (err) { 
        return errRes(res, 'Lỗi khi thêm dịch vụ', err); 
    }
};

// Lấy danh sách dịch vụ đã đặt của một booking
exports.getByBooking = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT bs.id, bs.booking_id, bs.service_id, s.service_name, s.price, bs.quantity, (s.price * bs.quantity) AS total, bs.appointment_time, bs.created_at FROM booking_services bs JOIN services s ON bs.service_id = s.service_id WHERE bs.booking_id = ?', [req.params.booking_id]);
        return res.json(rows);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy danh sách dịch vụ của booking', err); 
    }
};

// Hủy/Xóa dịch vụ khỏi một booking cụ thể
exports.removeFromBooking = async (req, res) => {
    try {
        const [r] = await db.query(
            'DELETE FROM booking_services WHERE id = ?', [req.params.id]
        );
        return r.affectedRows ? res.json({ 
            success: true, 
            message: 'Xóa dịch vụ khỏi booking thành công' }) : res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi xóa dịch vụ', err); 
    }
};