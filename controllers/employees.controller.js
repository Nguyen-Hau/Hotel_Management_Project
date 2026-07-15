const EmployeesService = require('../services/employees.service');

function errRes(res, msg, err) {
    console.error(msg, err);
    let chiTietLoi = '';
    if (err && err.message) {
        chiTietLoi = ': ' + err.message;
    }
    return res.status(500).json({ message: msg + chiTietLoi });
}

async function getAll(request, response) {
    try {
        const rows = await EmployeesService.getAll();
        return response.json(rows);
    } catch (err) {
        return errRes(response, 'Lỗi khi lấy danh sách nhân viên', err);
    }
}

async function create(request, response) {
    try {
        const result = await EmployeesService.create(request.body);
        return response.json(result);
    } catch (err) {
        if (err.message === 'MISSING_FIELDS') {
            return response.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
        }
        if (err.message === 'USERNAME_ALREADY_EXISTS') {
            return response.status(400).json({ message: 'Tên đăng nhập đã tồn tại trên hệ thống' });
        }
        return errRes(response, 'Lỗi khi thêm nhân viên', err);
    }
}

async function update(request, response) {
    try {
        const result = await EmployeesService.update(request.params.id, request.body);
        return response.json(result);
    } catch (err) {
        if (err.message === 'EMPLOYEE_NOT_FOUND') {
            return response.status(404).json({ message: 'Không tìm thấy thông tin nhân viên' });
        }
        return errRes(response, 'Lỗi khi cập nhật nhân viên', err);
    }
}

async function remove(request, response) {
    try {
        const result = await EmployeesService.remove(request.params.id);
        return response.json(result);
    } catch (err) {
        if (err.message === 'EMPLOYEE_NOT_FOUND') {
            return response.status(404).json({ message: 'Không tìm thấy nhân viên' });
        }
        return errRes(response, 'Lỗi khi xóa nhân viên', err);
    }
}

module.exports = {
    getAll,
    create,
    update,
    remove
};