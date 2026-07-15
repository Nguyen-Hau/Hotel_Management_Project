const CustomersService = require('../services/customers.service');

function errRes(res, msg, err) {
    console.error(msg, err);
    let chiTietLoi = '';
    if (err && err.message) {
        chiTietLoi = ': ' + err.message;
    }
    return res.status(500).json({ message: msg + chiTietLoi });
}

async function getAll(req, res) {
    try {
        const rows = await CustomersService.getAll(req.user);
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách khách hàng', err);
    }
}

async function getById(req, res) {
    try {
        const row = await CustomersService.getById(req.params.id, req.user);
        return res.json(row);
    } catch (err) {
        if (err.message === 'CUSTOMER_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
        }
        if (err.message === 'FORBIDDEN') {
            return res.status(403).json({ message: 'Không có quyền truy cập thông tin khách hàng này' });
        }
        return errRes(res, 'Lỗi khi lấy thông tin khách hàng', err);
    }
}

async function create(req, res) {
    try {
        const result = await CustomersService.create(req.body);
        return res.json(result);
    } catch (err) {
        return errRes(res, 'Lỗi khi thêm khách hàng', err);
    }
}

async function update(req, res) {
    try {
        const result = await CustomersService.update(req.params.id, req.body, req.user);
        return res.json(result);
    } catch (err) {
        if (err.message === 'FORBIDDEN') {
            return res.status(403).json({ message: 'Không có quyền sửa thông tin này' });
        }
        return errRes(res, 'Lỗi khi cập nhật khách hàng', err);
    }
}

async function remove(req, res) {
    try {
        const result = await CustomersService.remove(req.params.id, req.user);
        return res.json(result);
    } catch (err) {
        if (err.message === 'FORBIDDEN') {
            return res.status(403).json({ message: 'Không có quyền xóa khách hàng' });
        }
        if (err.message === 'CUSTOMER_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy khách hàng cần xóa' });
        }
        return errRes(res, 'Lỗi khi xóa khách hàng', err);
    }
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};