const db = require('../config/db');

// Hàm bắt lỗi và trả response nhanh trên 1 dòng
const errRes = (res, msg, err) => (console.error(msg, err), res.status(500).json({ message: msg }));

// Kiểm tra quốc gia tinh gọn bằng Object map
const getCountryFromPhone = p => {
    const pf = { 
        '+1': 'Hoa Kỳ', '+81': 'Nhật Bản', '+82': 'Hàn Quốc' 
    }, m = p && Object.keys(pf).find(k => p.startsWith(k));
    return p ? (m ? pf[m] : 'Việt Nam') : 'Việt Nam';
};

// Nhận tất cả khách hàng
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT customer_id, full_name, email, phone, country, cccd, created_at FROM customers ORDER BY customer_id DESC');
        return res.json(rows);
    } catch (err) { return errRes(res, 'Lỗi khi lấy danh sách khách hàng', err); }
};

// Tạo khách hàng mới
exports.create = async (req, res) => {
    try {
        const { full_name, email, phone, cccd, password } = req.body;
        const [result] = await db.query(
            'INSERT INTO customers (full_name, email, phone, country, cccd, password, role) VALUES (?, ?, ?, ?, ?, ?, "customer")', [full_name, email, phone, getCountryFromPhone(phone), cccd, password || '123456']);
        return res.json({ 
            success: true, message: 'Thêm khách hàng thành công', id: result.insertId 
        });
    } catch (err) { 
        return errRes(res, 'Lỗi khi thêm khách hàng', err); 
    }
};

// Cập nhật thông tin khách hàng
exports.update = async (req, res) => {
    try {
        const { full_name, email, phone, cccd, password } = req.body;
        let sql = 
        'UPDATE customers SET full_name=?, email=?, phone=?, country=?, cccd=?', 
        params = [full_name, email, phone, getCountryFromPhone(phone), cccd];
        if (password) (sql += ', password=?', params.push(password));
        await db.query(sql + ' WHERE customer_id=?', [...params, req.params.id]);
        return res.json({ success: true, message: 'Cập nhật khách hàng thành công' });
    } catch (err) { return errRes(res, 'Lỗi khi cập nhật khách hàng', err); }
};

// Xóa khách hàng
exports.remove = async (req, res) => {
    try {
        await db.query('DELETE FROM customers WHERE customer_id=?', [req.params.id]);
        return res.json({ success: true, message: 'Xóa khách hàng thành công' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi xóa khách hàng', err); 
    }
};