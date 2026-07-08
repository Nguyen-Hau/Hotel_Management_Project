const db = require('../config/db');
const bcrypt = require('bcryptjs');

function errRes(res, msg, err) {
    console.error(msg, err);
    return res.status(500).json({ message: msg });
}

async function getAll(req, res) {
    try {
        const [rows] = await db.query('SELECT employee_id, full_name, username, role FROM employees ORDER BY employee_id');
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách nhân viên', err);
    }
}

async function create(req, res) {
    try {
        const { full_name, username, password, role } = req.body;
        if (!full_name || !username || !password || !role) {
            return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
        }

        const [exist] = await db.query('SELECT 1 FROM employees WHERE username = ?', [username]);
        if (exist.length > 0) {
            return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại trên hệ thống' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO employees (full_name, username, password, role) VALUES (?, ?, ?, ?)',
            [full_name, username, hashedPassword, role]
        );

        return res.json({ success: true, message: 'Thêm nhân viên thành công', id: result.insertId });
    } catch (err) {
        return errRes(res, 'Lỗi khi thêm nhân viên', err);
    }
}

async function update(req, res) {
    try {
        const { full_name, username, role, password } = req.body;
        let sql = 'UPDATE employees SET full_name = ?, username = ?, role = ?';
        let params = [full_name, username, role];

        if (password && password.trim() !== '') {
            sql += ', password = ?';
            const hashedPassword = await bcrypt.hash(password, 10);
            params.push(hashedPassword);
        }

        sql += ' WHERE employee_id = ?';
        params.push(req.params.id);

        const [result] = await db.query(sql, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin nhân viên' });
        }
        return res.json({ success: true, message: 'Cập nhật nhân viên thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi cập nhật nhân viên', err);
    }
}

async function remove(req, res) {
    try {
        const [result] = await db.query('DELETE FROM employees WHERE employee_id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
        }
        return res.json({ success: true, message: 'Xóa tài khoản nhân viên thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi xóa nhân viên', err);
    }
}

module.exports = {
    getAll,
    create,
    update,
    remove
};