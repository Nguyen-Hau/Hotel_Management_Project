const db = require('../config/db');

function errRes(res, msg, err) {
    console.error(msg, err);
    return res.status(500).json({ message: msg });
}

function getCountryFromPhone(phone) {
    if (!phone) {
        return 'Việt Nam';
    }
    if (phone.startsWith('+1')) {
        return 'Hoa Kỳ';
    }
    if (phone.startsWith('+81')) {
        return 'Nhật Bản';
    }
    if (phone.startsWith('+82')) {
        return 'Hàn Quốc';
    }
    return 'Việt Nam';
}

async function getAll(req, res) {
    try {
        const [rows] = await db.query('SELECT customer_id, full_name, email, phone, country, cccd, created_at FROM customers ORDER BY customer_id DESC');
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách khách hàng', err);
    }
}

async function create(req, res) {
    try {
        const { full_name, email, phone, cccd, password } = req.body;
        const country = getCountryFromPhone(phone);
        const pass = password || '123456';
        
        const [result] = await db.query(
            'INSERT INTO customers (full_name, email, phone, country, cccd, password, role) VALUES (?, ?, ?, ?, ?, ?, "customer")', 
            [full_name, email, phone, country, cccd, pass]
        );
        
        return res.json({ success: true, message: 'Thêm khách hàng thành công', id: result.insertId });
    } catch (err) {
        return errRes(res, 'Lỗi khi thêm khách hàng', err);
    }
}

async function update(req, res) {
    try {
        const { full_name, email, phone, cccd, password } = req.body;
        const country = getCountryFromPhone(phone);
        
        let sql = 'UPDATE customers SET full_name = ?, email = ?, phone = ?, country = ?, cccd = ?';
        let params = [full_name, email, phone, country, cccd];
        
        if (password) {
            sql += ', password = ?';
            params.push(password);
        }
        
        sql += ' WHERE customer_id = ?';
        params.push(req.params.id);
        
        await db.query(sql, params);
        return res.json({ success: true, message: 'Cập nhật khách hàng thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi cập nhật khách hàng', err);
    }
}

async function remove(req, res) {
    try {
        const [result] = await db.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy khách hàng cần xóa' });
        }
        return res.json({ success: true, message: 'Xóa thông tin khách hàng thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi xóa khách hàng', err);
    }
}

module.exports = {
    getAll,
    create,
    update,
    remove
};