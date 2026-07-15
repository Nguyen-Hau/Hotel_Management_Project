const BookingsService = require('../services/bookings.service');

function errRes(res, msg, err) {
    console.error(msg, err);
    let chiTietLoi = '';
    if (err && err.message) {
        chiTietLoi = ': ' + err.message;
    }
    return res.status(500).json({ message: msg + chiTietLoi });
}

// 1. Lấy danh sách đặt phòng
async function getAll(req, res) {
    try {
        const bookings = await BookingsService.getAll(req.user);
        return res.json(bookings);
    } catch (err) {
        return errRes(res, 'Lỗi lấy danh sách đặt phòng', err);
    }
}

// 2. Lấy chi tiết đặt phòng bằng ID
async function getById(req, res) {
    try {
        const b = await BookingsService.getById(req.params.id, req.user);
        return res.json(b);
    } catch (err) {
        if (err.message === 'BOOKING_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng' });
        }
        if (err.message === 'FORBIDDEN') {
            return res.status(403).json({ message: 'Không có quyền xem thông tin này' });
        }
        return errRes(res, 'Lỗi lấy chi tiết đặt phòng', err);
    }
}

// 3. Tạo đơn đặt phòng mới
async function create(req, res) {
    try {
        const result = await BookingsService.create(req.user, req.body);
        return res.json(result);
    } catch (err) {
        if (err.message === 'CUSTOMER_ID_MISSING') {
            return res.status(400).json({ message: 'Thiếu thông tin khách hàng' });
        }
        if (err.message === 'ROOM_IDS_EMPTY') {
            return res.status(400).json({ message: 'Vui lòng chọn ít nhất một phòng' });
        }
        if (err.message.startsWith('ROOM_MAINTENANCE_')) {
            const roomNo = err.message.replace('ROOM_MAINTENANCE_', '');
            return res.status(400).json({ message: 'Phòng ' + roomNo + ' đang bảo trì' });
        }
        if (err.message.startsWith('ROOM_OVERLAP_')) {
            const parts = err.message.replace('ROOM_OVERLAP_', '').split('_');
            return res.status(400).json({
                message: `Phòng ${parts[0]} đã được đặt từ ngày ${parts[1]} đến ${parts[2]} bởi khách ${parts[3]}`
            });
        }
        if (err.message === 'ROOM_NOT_FOUND') {
            return res.status(404).json({ message: 'Phòng không tồn tại' });
        }
        return errRes(res, 'Lỗi khi đặt phòng', err);
    }
}

// 4. Xử lý Check-in nhận phòng
async function checkIn(req, res) {
    try {
        const result = await BookingsService.checkIn(req.params.id, req.body);
        return res.json(result);
    } catch (err) {
        if (err.message === 'BOOKING_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng' });
        }
        if (err.message === 'INVALID_STATUS') {
            return res.status(400).json({ message: 'Không thể check-in phòng này (trạng thái sai)' });
        }
        if (err.message === 'INCOMPLETE_INFO') {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ họ tên, số điện thoại và CCCD để check-in' });
        }
        if (err.message === 'NAME_MISMATCH') {
            return res.status(400).json({ message: 'Họ tên không khớp với thông tin đặt phòng' });
        }
        if (err.message === 'PHONE_MISMATCH') {
            return res.status(400).json({ message: 'Số điện thoại không khớp với thông tin đặt phòng' });
        }
        if (err.message === 'CCCD_MISMATCH') {
            return res.status(400).json({ message: 'CCCD không khớp với thông tin đặt phòng đã lưu' });
        }
        return errRes(res, 'Lỗi thực hiện check-in', err);
    }
}

// 5. Xử lý Check-out trả phòng & Tính hóa đơn
async function checkOut(req, res) {
    try {
        const result = await BookingsService.checkOut(req, req.params.id, req.body);
        return res.json(result);
    } catch (err) {
        if (err.message === 'BOOKING_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng' });
        }
        if (err.message === 'INVALID_STATUS') {
            return res.status(400).json({ message: 'Chỉ có thể check-out phòng đang ở' });
        }
        return errRes(res, 'Lỗi khi thực hiện check-out', err);
    }
}

// 6. Hủy đơn đặt phòng
async function cancel(req, res) {
    try {
        const result = await BookingsService.cancel(req, req.params.id);
        return res.json(result);
    } catch (err) {
        if (err.message === 'BOOKING_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng' });
        }
        if (err.message === 'FORBIDDEN') {
            return res.status(403).json({ message: 'Không có quyền hủy phòng của người khác' });
        }
        if (err.message === 'INVALID_STATUS') {
            return res.status(400).json({ message: 'Chỉ được phép hủy phòng khi đang ở trạng thái đã đặt' });
        }
        return errRes(res, 'Lỗi khi hủy đặt phòng', err);
    }
}

// 7. Gia hạn ngày check-out đặt phòng (Extend Booking)
async function extend(req, res) {
    try {
        const result = await BookingsService.extend(req.user, req.params.id, req.body);
        return res.json(result);
    } catch (err) {
        if (err.message === 'CHECK_OUT_MISSING') {
            return res.status(400).json({ message: 'Thiếu ngày check-out mới' });
        }
        if (err.message === 'BOOKING_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy đặt phòng' });
        }
        if (err.message === 'INVALID_STATUS') {
            return res.status(400).json({ message: 'Chỉ có thể gia hạn khi phòng chưa check-out' });
        }
        if (err.message === 'FORBIDDEN') {
            return res.status(403).json({ message: 'Không có quyền thực hiện' });
        }
        if (err.message === 'CHECK_OUT_BEFORE_CHECK_IN') {
            return res.status(400).json({ message: 'Ngày check-out mới phải sau ngày nhận phòng' });
        }
        if (err.message === 'CHECK_OUT_BEFORE_ORIGINAL') {
            return res.status(400).json({ message: 'Ngày check-out mới phải sau ngày check-out hiện tại' });
        }
        if (err.message.startsWith('ROOM_OVERLAP_')) {
            const parts = err.message.replace('ROOM_OVERLAP_', '').split('_');
            return res.status(400).json({
                message: `Phòng ${parts[0]} đã được đặt tiếp từ ngày ${parts[1]} đến ${parts[2]} bởi khách ${parts[3]}. Không thể gia hạn.`
            });
        }
        return errRes(res, 'Lỗi khi gia hạn đặt phòng', err);
    }
}

module.exports = {
    getAll,
    getById,
    create,
    checkIn,
    checkOut,
    cancel,
    extend
};