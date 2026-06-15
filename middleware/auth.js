const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'hotel_management_secret_key_2026';

// Middleware xác thực token JWT ngắn gọn
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) 
        return res.status(401).json({ 
    success: false, 
    message: 'Không có token xác thực. Vui lòng đăng nhập lại.' });

    try {
        req.user = jwt.verify(token, SECRET_KEY);
        return next();
    } catch (err) {
        return res.status(401).json({ 
            success: false, 
            message: err.name === 'TokenExpiredError' ? 'Token đã hết hạn. Vui lòng đăng nhập lại.' : 'Token không hợp lệ.' 
        });
    }
};

// Middleware kiểm tra role người dùng
const requireRole = (allowedRoles) => (req, res, next) => {
    if (!req.user) 
        return res.status(401).json({ 
    success: false, 
    message: 'Chưa xác thực người dùng.' 
    });

    if (!allowedRoles.includes(req.user.role)) 
        return res.status(403).json({ 
    success: false, 
    message: `Truy cập bị từ chối. Yêu cầu role: ${allowedRoles.join(', ')}` 
    });
    
    return next();
};

// Định nghĩa roles hệ thống
const ROLES = {
    ADMIN: ['Giám đốc'],
    MANAGER: ['Giám đốc', 'Quản lý'],
    STAFF: ['Giám đốc', 'Quản lý', 'Lễ tân'],
    CUSTOMER: ['customer'],
    ALL: ['Giám đốc', 'Quản lý', 'Lễ tân', 'customer']
};

module.exports = { verifyToken, requireRole, ROLES, SECRET_KEY };