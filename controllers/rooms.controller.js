const db = require('../config/db'), path = require('path'), fs = require('fs');

const errRes = (res, msg, err) => (console.error(msg, err), res.status(500).json({ message: msg + (err?.message ? ': ' + err.message : '') }));
const delImg = img => { if (img) { const pth = path.join(__dirname, '../../uploads', path.basename(img)); if (fs.existsSync(pth)) fs.unlinkSync(pth); } };

exports.getAll = async (req, res) => {
    try {
        const [rooms] = await db.query(
            'SELECT * FROM rooms ORDER BY room_number'
        );
        return res.json(rooms);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy danh sách phòng', err); 
    }
};

exports.getById = async (req, res) => {
    try {
        const [room] = await db.query(
            'SELECT * FROM rooms WHERE room_id = ?', [req.params.id]
        );
        return room.length ? res.json(room[0]) : res.status(404).json({ message: 'Không tìm thấy phòng' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy thông tin phòng', err); 
    }
};

exports.create = async (req, res) => {
    try {
        const { room_number, room_type, price, services, status } = req.body;
        const [result] = await db.query(
            'INSERT INTO rooms (room_number, room_type, price, image, services, status) VALUES (?, ?, ?, ?, ?, ?)', 
            [room_number, room_type, price, req.file ? `/uploads/${req.file.filename}` : null, services || null, status || 'available']);
        return res.json({ success: true, message: 'Thêm phòng thành công', id: result.insertId });
    } catch (err) { 
        return errRes(res, 'Lỗi khi thêm phòng', err); 
    }
};

exports.update = async (req, res) => {
    try {
        const { room_number, room_type, price, services, status } = req.body;
        let image = req.body.image;
        if (req.file) {
            const [old] = await db.query(
                'SELECT image FROM rooms WHERE room_id = ?', [req.params.id]
            );
            delImg(old[0]?.image);
            image = `/uploads/${req.file.filename}`;
        }
        await db.query(
            'UPDATE rooms SET room_number=?, room_type=?, price=?, image=?, services=?, status=? WHERE room_id=?', [room_number, room_type, price, image, services, status, req.params.id]);
        return res.json({ success: true, message: 'Cập nhật phòng thành công' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi cập nhật phòng', err); 
    }
};

exports.remove = async (req, res) => {
    try {
        const [room] = await db.query('SELECT image FROM rooms WHERE room_id = ?', [req.params.id]);
        await db.query(
            'DELETE FROM rooms WHERE room_id = ?', [req.params.id]
        );
        delImg(room[0]?.image);
        return res.json({ success: true, message: 'Xóa phòng thành công' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi xóa phòng', err); 
    }
};