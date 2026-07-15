const InvoicesService = require('../services/invoices.service');

function errRes(res, msg, err) {
    console.error(msg, err);
    let chiTietLoi = '';
    if (err && err.message) {
        chiTietLoi = ': ' + err.message;
    }
    return res.status(500).json({ message: msg + chiTietLoi });
}

// Lấy tất cả hóa đơn
async function getAll(req, res) {
    try {
        const rows = await InvoicesService.getAll(req.user);
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách hóa đơn', err);
    }
}

// Lấy chi tiết một hóa đơn
async function getById(req, res) {
    try {
        const invoiceData = await InvoicesService.getById(req.params.id);
        return res.json(invoiceData);
    } catch (err) {
        if (err.message === 'INVOICE_NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
        }
        return errRes(res, 'Lỗi lấy chi tiết hóa đơn', err);
    }
}

// Lấy hóa đơn theo Booking ID
async function getByBooking(req, res) {
    try {
        const invoice = await InvoicesService.getByBooking(req.params.id);
        return res.json(invoice);
    } catch (err) {
        if (err.message === 'INVOICE_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy hóa đơn cho đặt phòng này' });
        }
        return errRes(res, 'Lỗi lấy hóa đơn theo booking', err);
    }
}

// Thanh toán hóa đơn
async function pay(req, res) {
    try {
        const result = await InvoicesService.pay(req, req.params.id, req.body);
        return res.json(result);
    } catch (err) {
        if (err.message === 'INVOICE_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
        }
        if (err.message === 'INVOICE_ALREADY_PAID') {
            return res.status(400).json({ message: 'Hóa đơn này đã được thanh toán trước đó' });
        }
        return errRes(res, 'Lỗi khi thanh toán hóa đơn', err);
    }
}

// Gửi email hóa đơn
async function sendEmail(req, res) {
    try {
        const result = await InvoicesService.sendEmail(req.params.id);
        return res.json(result);
    } catch (err) {
        if (err.message === 'INVOICE_NOT_FOUND') {
            return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
        }
        if (err.message === 'EMAIL_MISSING') {
            return res.status(400).json({ message: 'Khách hàng này không có địa chỉ email' });
        }
        return errRes(res, 'Lỗi khi gửi email hóa đơn', err);
    }
}

module.exports = {
    getAll,
    getById,
    getByBooking,
    pay,
    sendEmail
};