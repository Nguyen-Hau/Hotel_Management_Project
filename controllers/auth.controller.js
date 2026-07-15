const AuthService = require('../services/auth.service');

async function login(request, response) {
    const { username, password } = request.body;
    try {
        const result = await AuthService.login(username, password);
        return response.json(result);
    } catch (err) {
        if (err.message === 'MISSING_USERNAME_PASSWORD') {
            return response.status(400).json({
                success: false,
                message: "Vui lòng nhập tài khoản và mật khẩu"
            });
        }
        if (err.message === 'ACCOUNT_LOCKED') {
            return response.status(403).json({
                success: false,
                message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên."
            });
        }
        if (err.message === 'INVALID_CREDENTIALS') {
            return response.status(401).json({
                success: false,
                message: "Tài khoản hoặc mật khẩu không chính xác"
            });
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi máy chủ: " + err.message
        });
    }
}

async function register(request, response) {
    try {
        const result = await AuthService.register(request.body);
        return response.status(200).json(result);
    } catch (err) {
        if (err.message === 'MISSING_FIELDS') {
            return response.status(400).json({
                success: false,
                message: "Vui lòng điền đầy đủ thông tin bắt buộc"
            });
        }
        if (err.message === 'EMAIL_PHONE_EXISTS') {
            return response.status(400).json({
                success: false,
                message: "Email hoặc số điện thoại đã được đăng ký"
            });
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi máy chủ: " + err.message
        });
    }
}

module.exports = {
    login,
    register
};