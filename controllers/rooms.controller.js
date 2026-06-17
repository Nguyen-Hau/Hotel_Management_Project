const db = require('../config/db');
const path = require('path');
const fs = require('fs');

function errRes(res, msg, err) {
    console.error(msg, err);
    return res.status(500).json({ message: msg + (err?.message ? ': ' + err.message : '') });
}

function delImg(img) {
    if (img) {
        const pth = path.join(__dirname, '../../uploads', path.basename(img));
        if (fs.existsSync(pth)) {
            fs.unlinkSync(pth);
        }
    }
}

async function getAll(req, res) {
    try {
        const [rooms] = await db.query('SELECT * FROM rooms ORDER BY room_number');
        return res.json(rooms);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách phòng', err);
    }
}

async function getById(req, res) {
    try {
        const [room] = await db.query('SELECT * FROM rooms WHERE room_id = ?', [req.params.id]);
        if (room.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin phòng này' });
        }
        return res.json(room[0]);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy thông tin phòng', err);
    }
}

async function create(req, res) {
    try {
        const { room_number, room_type, price, services, status } = req.body;
        let image = null;
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        }
        
        const roomStatus = status || 'available';
        const [result] = await db.query(
            'INSERT INTO rooms (room_number, room_type, price, image, services, status) VALUES (?, ?, ?, ?, ?, ?)', 
            [room_number, room_type, price, image, services, roomStatus]
        );
        return res.json({ success: true, message: 'Thêm phòng mới thành công', id: result.insertId });
    } catch (err) {
        return errRes(res, 'Lỗi khi thêm phòng', err);
    }
}

async function update(req, res) {
    try {
        const { room_number, room_type, price, services, status } = req.body;
        let image = req.body.image;
        
        if (req.file) {
            const [old] = await db.query('SELECT image FROM rooms WHERE room_id = ?', [req.params.id]);
            if (old.length > 0) {
                delImg(old[0].image);
            }
            image = `/uploads/${req.file.filename}`;
        }
        
        await db.query(
            'UPDATE rooms SET room_number = ?, room_type = ?, price = ?, image = ?, services = ?, status = ? WHERE room_id = ?', 
            [room_number, room_type, price, image, services, status, req.params.id]
        );
        return res.json({ success: true, message: 'Cập nhật phòng thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi cập nhật thông tin phòng', err);
    }
}

async function remove(req, res) {
    try {
        const [room] = await db.query('SELECT image FROM rooms WHERE room_id = ?', [req.params.id]);
        if (room.length > 0) {
            delImg(room[0].image);
        }
        
        await db.query('DELETE FROM rooms WHERE room_id = ?', [req.params.id]);
        return res.json({ success: true, message: 'Xóa phòng thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi xóa phòng', err);
    }
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};