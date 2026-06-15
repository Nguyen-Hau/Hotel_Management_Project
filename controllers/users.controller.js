const db = require('../config/db'), bcrypt = require('bcryptjs');

// Hàm bắt lỗi và trả response nhanh gọn trên 1 dòng
const errRes = (res, msg, err) => (console.error(msg, err), res.status(500).json({ message: msg }));

// Nhận tất cả người dùng
exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT employee_id, full_name, username, role, created_at FROM employees ORDER BY employee_id DESC');
        return res.json(rows);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy danh sách người dùng', err); 
    }
};

// Tạo người dùng mới
exports.createUser = async (req, res) => {
    try {
        const { full_name, username, password, role } = req.body;
        if (!full_name || !username || !password || !role) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });

        const [exist] = await db.query(
            'SELECT 1 FROM employees WHERE username = ?', [username]
        );
        if (exist.length) 
            return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });

        const [r] = await db.query(
            'INSERT INTO employees (full_name, username, password, role) VALUES (?, ?, ?, ?)', [full_name, username, await bcrypt.hash(password, 10), role]);
        return res.json({ success: true, message: 'Thêm người dùng thành công', userId: r.insertId });
    } catch (err) { 
        return errRes(res, 'Lỗi khi thêm người dùng', err); 
    }
};

// Cập nhật thông tin người dùng
exports.updateUser = async (req, res) => {
    try {
        const userId = req.params.id, { full_name, username, role, password } = req.body;
        if (parseInt(userId) === req.user.id) 
            return res.status(400).json({ message: 'Không thể tự thay đổi thông tin của chính mình qua đây' 
        });

        let sql = 
        'UPDATE employees SET full_name = ?, username = ?, role = ?', 
        params = [full_name, username, role];
        if (password?.trim()) (sql += ', password = ?', params.push(await bcrypt.hash(password, 10)));

        const [r] = await db.query(sql + ' WHERE employee_id = ?', [...params, userId]);
        return r.affectedRows ? res.json({ success: true, message: 'Cập nhật người dùng thành công' }) : res.status(404).json({ message: 'Không tìm thấy người dùng' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi cập nhật người dùng', err); 
    }
};

// Xóa người dùng
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        if (parseInt(userId) === req.user.id) 
            return res.status(400).json({ message: 'Không thể tự xóa tài khoản của chính mình' 
        });

        const [r] = await db.query(
            'DELETE FROM employees WHERE employee_id = ?', [userId]
        );
        return r.affectedRows ? res.json({ 
            success: true, 
            message: 'Xóa người dùng thành công' }) : res.status(404).json({ message: 'Không tìm thấy người dùng' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi xóa người dùng', err); }
};

// Nhận thông tin chi tiết một người dùng theo ID
exports.getUserById = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT employee_id, full_name, username, role FROM employees WHERE employee_id = ?', [req.params.id]
        );
        return rows.length ? res.json(rows[0]) : res.status(404).json({ message: 'Không tìm thấy người dùng' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy thông tin người dùng', err); 
    }
};