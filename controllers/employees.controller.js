const db = require('../config/db'), bcrypt = require('bcryptjs');

// Hàm bắt lỗi và trả response nhanh trên 1 dòng
const errRes = (res, msg, err) => (console.error(msg, err), res.status(500).json({ message: msg }));

// Lấy tất cả nhân viên
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT employee_id, full_name, username, role FROM employees ORDER BY employee_id');
        return res.json(rows);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy danh sách nhân viên', err); 
    }
};

// Tạo nhân viên mới
exports.create = async (req, res) => {
    try {
        const { full_name, username, password, role } = req.body;
        if (!full_name || !username || !password || !role) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });

        const [exist] = await db.query(
            'SELECT 1 FROM employees WHERE username = ?', [username]);
        if (exist.length) return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });

        const [result] = await db.query(
            'INSERT INTO employees (full_name, username, password, role) VALUES (?, ?, ?, ?)', [full_name, username, await bcrypt.hash(password, 10), role]);
        return res.json({ success: true, message: 'Thêm nhân viên thành công', id: result.insertId });
    } catch (err) { 
        return errRes(res, 'Lỗi khi thêm nhân viên', err); 
    }
};

// Cập nhật thông tin nhân viên
exports.update = async (req, res) => {
    try {
        const { full_name, username, role, password } = req.body;
        let sql = 
        'UPDATE employees SET full_name = ?, username = ?, role = ?', params = [full_name, username, role];
        
        if (password?.trim()) (sql += ', password = ?', params.push(await bcrypt.hash(password, 10)));
        
        const [result] = await db.query(sql + ' WHERE employee_id = ?', [...params, req.params.id]);
        return result.affectedRows ? res.json({ 
            success: true, 
            message: 'Cập nhật nhân viên thành công' }) : res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi cập nhật nhân viên', err); 
    }
};

// Xóa nhân viên
exports.remove = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM employees WHERE employee_id = ?', [req.params.id]);
        return result.affectedRows ? res.json({ 
            success: true, message: 'Xóa nhân viên thành công' }) : res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi xóa nhân viên', err); 
    }
};