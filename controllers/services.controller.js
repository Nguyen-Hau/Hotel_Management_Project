const ServicesService = require('../services/services.service');

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
        const rows = await ServicesService.getAll();
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách dịch vụ', err);
    }
}

async function create(req, res) {
    try {
        const result = await ServicesService.create(req.body);
        return res.json(result);
    } catch (err) {
        return errRes(res, 'Lỗi khi thêm dịch vụ', err);
    }
}

async function update(req, res) {
    try {
        const result = await ServicesService.update(req.params.id, req.body);
        return res.json(result);
    } catch (err) {
        return errRes(res, 'Lỗi khi cập nhật dịch vụ', err);
    }
}

async function remove(req, res) {
    try {
        const result = await ServicesService.remove(req.params.id);
        return res.json(result);
    } catch (err) {
        return errRes(res, 'Lỗi khi xóa dịch vụ', err);
    }
}

async function addToBooking(req, res) {
    try {
        const result = await ServicesService.addToBooking(req.body);
        return res.json(result);
    } catch (err) {
        if (err.message === 'SERVICE_NOT_FOUND') {
            return res.status(404).json({ message: 'Dịch vụ này không tồn tại trên hệ thống' });
        }
        return errRes(res, 'Lỗi khi thêm dịch vụ vào phòng', err);
    }
}

async function getByBooking(req, res) {
    try {
        const rows = await ServicesService.getByBooking(req.params.booking_id);
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách dịch vụ của phòng', err);
    }
}

async function removeFromBooking(req, res) {
    try {
        const result = await ServicesService.removeFromBooking(req.params.id);
        return res.json(result);
    } catch (err) {
        return errRes(res, 'Lỗi khi hủy dịch vụ khỏi phòng', err);
    }
}

module.exports = {
    getAll,
    create,
    update,
    remove,
    addToBooking,
    getByBooking,
    removeFromBooking
};