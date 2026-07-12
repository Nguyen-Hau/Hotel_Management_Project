const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'hotel_management_secret_key_2026';

// Xác thực và bảo mật token
const verifyToken = (request, response, next) => {
    const authHeader = request.headers.authorization; // Lấy token từ header authorization

    // Kiểm tra có header authorization không
    if (!authHeader) { // Kiểm tra header authorization có tồn tại không
        return response.status(401).json({
            success: false, // Trả về false vì không có token
            message: 'Không có token xác thực. Vui lòng đăng nhập lại.' // Trả về thông báo lỗi
        });
    }

    // Lấy token từ header authorization
    const token = authHeader.split(' ')[1]; // Tách token từ header authorization

    // Kiểm tra có token không
    if (!token) { // Kiểm tra token có tồn tại không
        return response.status(401).json({
            success: false, // Trả về false vì không có token
            message: 'Không có token xác thực. Vui lòng đăng nhập lại.' // Trả về thông báo lỗi
        });
    }

    // Giải mã token
    try {
        // Lấy thông tin user từ token
        request.user = jwt.verify(token, SECRET_KEY);
        return next();
    } catch (err) {
        // Kiểm tra lỗi token
        let errMsg = 'Token không hợp lệ.';

        // Kiểm tra token đã hết hạn chưa
        if (err.name === 'TokenExpiredError') {
            errMsg = 'Token đã hết hạn. Vui lòng đăng nhập lại.';
        }

        // Trả về lỗi xác thực
        return response.status(401).json({
            success: false,
            message: errMsg
        });
    }
};

// Kiểm tra quyền truy cập của người dùng
const requireRole = (allowedRoles) => {
    // Trả về function
    return (request, response, next) => {
        // Kiểm tra có user trong request không
        if (!request.user) {
            return response.status(401).json({
                success: false,
                message: 'Chưa xác thực người dùng.'
            });
        }

        // Kiểm tra role người dùng có trong danh sách role được phép không
        if (!allowedRoles.includes(request.user.role)) {
            return response.status(403).json({
                success: false,
                message: 'Truy cập bị từ chối. Yêu cầu role: ' + allowedRoles.join(', ')
            });
        }

        return next();
    };
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