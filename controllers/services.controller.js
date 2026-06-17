const db = require('../config/db');

function errRes(res, msg, err) {
    console.error(msg, err);
    return res.status(500).json({ message: msg });
}

async function getAll(req, res) {
    try {
        const [rows] = await db.query('SELECT * FROM services ORDER BY service_id');
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách dịch vụ', err);
    }
}

async function create(req, res) {
    try {
        const [result] = await db.query(
            'INSERT INTO services (service_name, price) VALUES (?, ?)', 
            [req.body.service_name, req.body.price]
        );
        return res.json({ success: true, message: 'Thêm dịch vụ thành công', id: result.insertId });
    } catch (err) {
        return errRes(res, 'Lỗi khi thêm dịch vụ', err);
    }
}

async function update(req, res) {
    try {
        await db.query(
            'UPDATE services SET service_name = ?, price = ? WHERE service_id = ?', 
            [req.body.service_name, req.body.price, req.params.id]
        );
        return res.json({ success: true, message: 'Cập nhật dịch vụ thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi cập nhật dịch vụ', err);
    }
}

async function remove(req, res) {
    try {
        await db.query('DELETE FROM services WHERE service_id = ?', [req.params.id]);
        return res.json({ success: true, message: 'Xóa dịch vụ thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi xóa dịch vụ', err);
    }
}

async function addToBooking(req, res) {
    const { booking_id, service_id, quantity, appointment_time } = req.body;
    try {
        const [sv] = await db.query('SELECT price FROM services WHERE service_id = ?', [service_id]);
        if (sv.length === 0) {
            return res.status(404).json({ message: 'Dịch vụ này không tồn tại trên hệ thống' });
        }
        
        const qty = quantity || 1;
        const time = appointment_time || null;
        
        const [r] = await db.query(
            'INSERT INTO booking_services (booking_id, service_id, quantity, price, appointment_time) VALUES (?, ?, ?, ?, ?)', 
            [booking_id, service_id, qty, sv[0].price, time]
        );
        return res.json({ success: true, message: 'Đã thêm dịch vụ vào đơn đặt phòng thành công', id: r.insertId });
    } catch (err) {
        return errRes(res, 'Lỗi khi thêm dịch vụ vào phòng', err);
    }
}

async function getByBooking(req, res) {
    try {
        const sql = `
            SELECT bs.id, bs.booking_id, bs.service_id, s.service_name, s.price, bs.quantity, 
                   (s.price * bs.quantity) AS total, bs.appointment_time, bs.created_at 
            FROM booking_services bs 
            JOIN services s ON bs.service_id = s.service_id 
            WHERE bs.booking_id = ?
        `;
        const [rows] = await db.query(sql, [req.params.booking_id]);
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách dịch vụ của phòng', err);
    }
}

async function removeFromBooking(req, res) {
    try {
        await db.query('DELETE FROM booking_services WHERE id = ?', [req.params.id]);
        return res.json({ success: true, message: 'Đã hủy dịch vụ khỏi phòng này' });
    } catch (err) {
        return errRes(res, 'Lỗi khi hủy dịch vụ khỏi phòng', err);
    }
}

module.exports = {
    getAll,
    create,
    update,
    remove,
    addToBooking,
    getByBooking,
    removeFromBooking
};