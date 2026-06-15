const db = require('../config/db'), 
jwt = require('jsonwebtoken');

const SECRET_KEY = 
process.env.JWT_SECRET || 
'hotel_management_secret_key_2026';

// Tìm quốc gia gọn trong 2 dòng
const getCountryFromPhone = p => {
    const pf = { '+1': 'Hoa Kỳ', '+81': 'Nhật Bản', '+82': 'Hàn Quốc' }, 
    m = p && Object.keys(pf).find(k => p.startsWith(k));
    return m ? pf[m] : 'Việt Nam';
};

// Tạo payload đồng nhất dạng single-expression
const getPayload = (u, type) => ({
    id: u.employee_id || u.customer_id || u.id, full_name: u.full_name, role: u.role || 'customer', type,
    ...(type === 'employee' ? { username: u.username } : { email: u.email, phone: u.phone, country: u.country })
});

// Xu lys dang nhap
exports.login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ 
        success: false, message: 'Vui lòng nhập tài khoản và mật khẩu' 
    });

    try {
        // Kiểm tra employee và trả về luôn nếu khớp
        const [emps] = await db.query('SELECT * FROM employees WHERE username = ?', [username]);
        if (emps[0]?.password === password) return res.json({ 
            success: true, message: 'Đăng nhập thành công', 
            token: jwt.sign(getPayload(emps[0], 'employee'), 
            SECRET_KEY, { expiresIn: '8h' }), user: getPayload(emps[0], 'employee') 
        });

        // Kiểm tra customer và trả về luôn nếu khớp
        const [custs] = await db.query('SELECT * FROM customers WHERE email = ? OR phone = ?', [username, username]);
        if (custs[0]?.password === password) 
            return res.json({ 
            success: true, message: 'Đăng nhập thành công', 
            token: jwt.sign(getPayload(custs[0], 'customer'), 
            SECRET_KEY, { expiresIn: '30d' }),
            user: getPayload(custs[0], 'customer') 
        });

        return res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu' });
    } catch (err) { 
        return res.status(500).json({ 
            success: false, message: `Lỗi server: ${err.message}` 
        }); 
    }
};

// Xu ly dang ky
exports.register = async (req, res) => {
    const { full_name, email, phone, password, cccd } = req.body;
    if (!full_name || !email || !phone || !password) 
        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin' 
    });

    try {
        const [exist] = await db.query('SELECT 1 FROM customers WHERE email = ? OR phone = ?', [email, phone]);
        if (exist.length) 
            return res.status(400).json({ 
            success: false, message: 'Email hoặc số điện thoại đã được đăng ký' 
        });

        const country = getCountryFromPhone(phone);
        const [resDb] = await db.query(
            `INSERT INTO customers (full_name, email, phone, country, cccd, password, role, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, 'customer', NOW())`, 
            [full_name, email, phone, country, cccd || null, password]
        );

        const payload = getPayload({ 
            id: resDb.insertId, full_name, email, phone, country }, 
            'customer'
        );
        return res.json({ 
            success: true, 
            message: 'Đăng ký thành công', 
            token: jwt.sign(payload, SECRET_KEY, { expiresIn: '30d' }), user: payload 
        });
    } catch (err) { 
        return res.status(500).json({ 
            success: false, message: `Lỗi khi đăng ký: ${err.message}` 
        }); 
    }
};