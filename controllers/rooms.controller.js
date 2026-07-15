const RoomsService = require('../services/rooms.service');

// 1. Lấy tất cả phòng (có hoặc không có thời gian lọc)
async function getAll(request, response) {
    try {
        const rooms = await RoomsService.getAll(request.query);
        return response.json(rooms);
    } catch (err) {
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 2. Lấy thông tin phòng theo id
async function getById(request, response) {
    try {
        const room = await RoomsService.getById(request.params.id);
        return response.json(room);
    } catch (err) {
        if (err.message === 'ROOM_NOT_FOUND') {
            return response.status(404).json({ message: 'Không tìm thấy thông tin phòng này' });
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 3. Thêm phòng mới
async function create(request, response) {
    try {
        const result = await RoomsService.create(request.body, request.file);
        return response.json(result);
    } catch (err) {
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 4. Cập nhật thông tin phòng
async function update(request, response) {
    try {
        const result = await RoomsService.update(request, request.params.id, request.body, request.file);
        return response.json(result);
    } catch (err) {
        if (err.message === 'ROOM_NOT_FOUND') {
            return response.status(404).json({ message: 'Không tìm thấy thông tin phòng này' });
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 5. Xóa phòng
async function remove(request, response) {
    try {
        const result = await RoomsService.remove(request.params.id);
        return response.json(result);
    } catch (err) {
        if (err.message === 'ROOM_NOT_FOUND') {
            return response.status(404).json({ message: 'Không tìm thấy thông tin phòng này' });
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 6. Nhập danh sách phòng từ file Excel
async function importExcel(request, response) {
    try {
        const result = await RoomsService.importExcel(request.file);
        return response.json(result);
    } catch (err) {
        if (err.message === 'FILE_MISSING') {
            return response.status(400).json({ message: 'Vui lòng chọn file Excel để tải lên' });
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 7. Lấy danh sách phòng cho buồng phòng dọn dẹp
async function getHousekeepingRooms(request, response) {
    try {
        const rooms = await RoomsService.getHousekeepingRooms();
        return response.json(rooms);
    } catch (err) {
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 8. Bắt đầu dọn phòng
async function startCleaning(request, response) {
    try {
        const result = await RoomsService.startCleaning(request, request.params.id);
        return response.json(result);
    } catch (err) {
        if (err.message === 'ROOM_NOT_FOUND') {
            return response.status(404).json({ message: 'Không tìm thấy phòng' });
        }
        if (err.message === 'INVALID_STATUS_DIRTY') {
            return response.status(400).json({ message: 'Chỉ có thể dọn phòng khi phòng đang ở trạng thái bẩn (dirty)' });
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 9. Hoàn thành dọn phòng
async function finishCleaning(request, response) {
    try {
        const result = await RoomsService.finishCleaning(request, request.params.id);
        return response.json(result);
    } catch (err) {
        if (err.message === 'ROOM_NOT_FOUND') {
            return response.status(404).json({ message: 'Không tìm thấy phòng' });
        }
        if (err.message === 'INVALID_STATUS_CLEANING') {
            return response.status(400).json({ message: 'Chỉ có thể hoàn thành khi phòng đang dọn dẹp (cleaning)' });
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 10. Xác nhận phòng sạch
async function confirmCleaned(request, response) {
    try {
        const result = await RoomsService.confirmCleaned(request, request.params.id);
        return response.json(result);
    } catch (err) {
        if (err.message === 'ROOM_NOT_FOUND') {
            return response.status(404).json({ message: 'Không tìm thấy phòng' });
        }
        if (err.message === 'INVALID_STATUS_CONFIRM') {
            return response.status(400).json({ message: 'Trạng thái phòng không phù hợp để xác nhận sạch' });
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    importExcel,
    getHousekeepingRooms,
    startCleaning,
    finishCleaning,
    confirmCleaned
};