const UsersService = require('../services/users.service');

function errRes(response, msg, err) {
    console.error(msg, err);
    let chiTietLoi = '';
    if (err && err.message) {
        chiTietLoi = ': ' + err.message;
    }
    return response.status(500).json({ message: msg + chiTietLoi });
}

// 2. Lấy tất cả các tài khoản
async function getAllUsers(request, response) {
    try {
        const rows = await UsersService.getAllUsers();
        return response.json(rows);
    } catch (err) {
        return errRes(response, "Lỗi khi lấy danh sách tài khoản", err);
    }
}

// 3. Thêm tài khoản mới
async function createUser(request, response) {
    try {
        const result = await UsersService.createUser(request.body);
        return response.json(result);
    } catch (err) {
        if (err.message === 'MISSING_FIELDS') {
            return response.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
        }
        if (err.message === 'USERNAME_ALREADY_EXISTS') {
            return response.status(400).json({ message: "Tên đăng nhập hệ thống đã tồn tại" });
        }
        return errRes(response, "Lỗi khi tạo người dùng", err);
    }
}

// 4. Cập nhật thông tin tài khoản
async function updateUser(request, response) {
    try {
        const result = await UsersService.updateUser(request.params.id, request.body);
        return response.json(result);
    } catch (err) {
        if (err.message === 'USER_NOT_FOUND') {
            return response.status(404).json({ message: "Không tìm thấy tài khoản người dùng" });
        }
        return errRes(response, "Lỗi khi cập nhật thông tin người dùng", err);
    }
}

// 5. Xóa tài khoản người dùng
async function deleteUser(request, response) {
    try {
        const result = await UsersService.deleteUser(request.params.id, request.user.id);
        return response.json(result);
    } catch (err) {
        if (err.message === 'CANNOT_DELETE_SELF') {
            return response.status(400).json({ message: "Không được phép tự xóa tài khoản chính mình đang đăng nhập" });
        }
        if (err.message === 'USER_NOT_FOUND') {
            return response.status(404).json({ message: "Không tìm thấy người dùng cần xóa" });
        }
        return errRes(response, "Lỗi khi xóa người dùng khỏi hệ thống", err);
    }
}

// 6. Lấy thông tin chi tiết của tài khoản
async function getUserById(request, response) {
    try {
        const user = await UsersService.getUserById(request.params.id);
        return response.json(user);
    } catch (err) {
        if (err.message === 'USER_NOT_FOUND') {
            return response.status(404).json({ message: "Không tìm thấy người dùng" });
        }
        return errRes(response, "Lỗi khi lấy thông tin chi tiết người dùng", err);
    }
}

module.exports = {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserById,
};
