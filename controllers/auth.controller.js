const db = require('../config/db');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'hotel_management_secret_key_2026';

// Hàm kiểm tra đầu số điện thoại 
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

// Tách hàm tạo Payload ra thành cấu trúc dễ hiểu
function createTokenPayload(user, type) {
    const payload = {
        id: user.employee_id || user.customer_id || user.id,
        full_name: user.full_name,
        role: user.role || 'customer',
        type: type
    };

    if (type === 'employee') {
        payload.username = user.username;
    } else {
        payload.email = user.email;
        payload.phone = user.phone;
        payload.country = user.country;
    }
    return payload;
}

// Xử lý đăng nhập
async function login(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản và mật khẩu' });
    }

    try {
        // Kiểm tra trong bảng nhân viên trước
        const [employees] = await db.query('SELECT * FROM employees WHERE username = ?', [username]);
        if (employees.length > 0) {
            const emp = employees[0];
            // So sánh mật khẩu trực tiếp (theo dữ liệu mẫu thô ban đầu của nhóm)
            if (password === emp.password) {
                const payload = createTokenPayload(emp, 'employee');
                const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '24h' });
                return res.json({ success: true, message: 'Đăng nhập thành công (Nhân viên)', token, user: payload });
            }
        }

        // Nếu không phải nhân viên thì kiểm tra bên khách hàng (username lúc này đóng vai trò là email)
        const [customers] = await db.query('SELECT * FROM customers WHERE email = ?', [username]);
        if (customers.length > 0) {
            const cust = customers[0];
            if (password === cust.password) {
                const payload = createTokenPayload(cust, 'customer');
                const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '24h' });
                return res.json({ success: true, message: 'Đăng nhập thành công (Khách hàng)', token, user: payload });
            }
        }

        return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + err.message });
    }
}

// Xử lý đăng ký
async function register(req, res) {
    const { full_name, email, phone, password, cccd } = req.body;
    if (!full_name || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }

    try {
        const [exist] = await db.query('SELECT 1 FROM customers WHERE email = ? OR phone = ?', [email, phone]);
        if (exist.length > 0) {
            return res.status(400).json({ success: false, message: 'Email hoặc số điện thoại đã được đăng ký' });
        }

        const country = getCountryFromPhone(phone);
        
        // Thầy bỏ luôn trường created_at ở đây vì Database đã có DEFAULT CURRENT_TIMESTAMP lo rồi!
        const [resDb] = await db.query(
            `INSERT INTO customers (full_name, email, phone, country, cccd, password, role) 
             VALUES (?, ?, ?, ?, ?, ?, 'customer')`, 
            [full_name, email, phone, country, cccd || null, password]
        );

        const userData = {
            id: resDb.insertId,
            full_name,
            email,
            phone,
            country
        };
        const payload = createTokenPayload(userData, 'customer');
        const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '24h' });

        return res.json({
            success: true,
            message: 'Đăng ký tài khoản thành công',
            token,
            user: payload
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + err.message });
    }
}

module.exports = {
    login,
    register
};