const db = require('../config/db');
const auditService = require('../services/audit.service');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function errRes(res, msg, err) {
    console.error(msg, err);
    return res.status(500).json({ 
        message: msg + (err?.message ? ': ' + err.message : '') 
    });
}

// Lấy tất cả hóa đơn
async function getAll(req, res) {
    try {
        let sql = `
            SELECT i.*, c.full_name as customer_name, c.email as customer_email, c.phone, 
                   r.room_number, r.room_type, b.check_in, b.check_out, b.total_nights, b.booking_group_id 
            FROM invoices i 
            JOIN bookings b ON i.booking_id = b.booking_id 
            JOIN customers c ON b.customer_id = c.customer_id 
            JOIN rooms r ON b.room_id = r.room_id
        `;
        
        let params = [];
        if (req.user.role === 'customer') {
            sql += " WHERE c.customer_id = ?";
            params.push(req.user.id);
        }
        
        sql += " ORDER BY i.invoice_id DESC";
        const [rows] = await db.query(sql, params);
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách hóa đơn', err);
    }
}

// Lấy chi tiết một hóa đơn
async function getById(req, res) {
    try {
        const invoiceId = req.params.id;
        const invoiceSql = `
            SELECT i.*, 
                   c.full_name as customer_name, 
                   c.email as customer_email, 
                   c.phone as customer_phone, 
                   r.room_number, r.room_type, 
                   b.check_in, b.check_out, b.total_nights, b.booking_group_id
            FROM invoices i
            JOIN bookings b ON i.booking_id = b.booking_id
            JOIN customers c ON b.customer_id = c.customer_id
            JOIN rooms r ON b.room_id = r.room_id
            WHERE i.invoice_id = ?
        `;
        
        const [invoiceRows] = await db.query(invoiceSql, [invoiceId]);
        
        if (invoiceRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
        }
        
        const invoiceData = invoiceRows[0];

        // Lấy danh sách dịch vụ đi kèm
        const servicesSql = `
            SELECT bs.service_id, s.service_name, bs.price, bs.quantity
            FROM booking_services bs
            JOIN services s ON bs.service_id = s.service_id
            WHERE bs.booking_id = ?
        `;
        const [serviceRows] = await db.query(servicesSql, [invoiceData.booking_id]);
        invoiceData.services = serviceRows;

        // Nếu thuộc nhóm đặt nhiều phòng, lấy tất cả các hóa đơn trong nhóm
        if (invoiceData.booking_group_id) {
            const groupInvoicesSql = `
                SELECT i.*, r.room_number, r.room_type, b.booking_id
                FROM invoices i
                JOIN bookings b ON i.booking_id = b.booking_id
                JOIN rooms r ON b.room_id = r.room_id
                WHERE b.booking_group_id = ?
            `;
            const [groupRows] = await db.query(groupInvoicesSql, [invoiceData.booking_group_id]);
            
            // Lấy các dịch vụ cho từng hóa đơn trong nhóm
            for (let gInv of groupRows) {
                const [gSvs] = await db.query(servicesSql, [gInv.booking_id]);
                gInv.services = gSvs;
            }
            invoiceData.group_invoices = groupRows;
        }

        return res.json(invoiceData);
    } catch (err) {
        return errRes(res, 'Lỗi lấy chi tiết hóa đơn', err);
    }
}

// Lấy hóa đơn theo Booking ID
async function getByBooking(req, res) {
    try {
        const [rows] = await db.query('SELECT * FROM invoices WHERE booking_id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy hóa đơn cho đặt phòng này' });
        }
        return res.json(rows[0]);
    } catch (err) {
        return errRes(res, 'Lỗi lấy hóa đơn theo booking', err);
    }
}

// Thanh toán hóa đơn
async function pay(req, res) {
    try {
        const { payment_method, pay_group } = req.body;
        const [invoiceRows] = await db.query(
            `SELECT i.status, b.booking_group_id 
             FROM invoices i 
             JOIN bookings b ON i.booking_id = b.booking_id 
             WHERE i.invoice_id = ?`, 
            [req.params.id]
        );
        
        if (invoiceRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
        }
        if (invoiceRows[0].status === 'paid') {
            return res.status(400).json({ message: 'Hóa đơn này đã được thanh toán trước đó' });
        }

        if (pay_group && invoiceRows[0].booking_group_id) {
            // Lấy danh sách hóa đơn sẽ được thanh toán để ghi log
            const [toPayInvs] = await db.query(
                `SELECT i.invoice_id FROM invoices i 
                 JOIN bookings b ON i.booking_id = b.booking_id 
                 WHERE b.booking_group_id = ? AND i.status != 'paid'`,
                [invoiceRows[0].booking_group_id]
            );

            await db.query(
                `UPDATE invoices i
                 JOIN bookings b ON i.booking_id = b.booking_id
                 SET i.status = 'paid', i.payment_method = ?, i.paid_at = NOW()
                 WHERE b.booking_group_id = ? AND i.status != 'paid'`,
                [payment_method || 'cash', invoiceRows[0].booking_group_id]
            );

            for (let inv of toPayInvs) {
                await auditService.logAction(req, 'PAY_INVOICE', 'invoices', inv.invoice_id, 
                    { status: 'unpaid' }, 
                    { status: 'paid', payment_method }
                );
            }

            return res.json({ success: true, message: 'Thanh toán gộp các hóa đơn thành công' });
        } else {
            await db.query(
                "UPDATE invoices SET status = 'paid', payment_method = ?, paid_at = NOW() WHERE invoice_id = ?", 
                [payment_method || 'cash', req.params.id]
            );

            await auditService.logAction(req, 'PAY_INVOICE', 'invoices', req.params.id, 
                { status: 'unpaid' }, 
                { status: 'paid', payment_method }
            );

            return res.json({ success: true, message: 'Thanh toán hóa đơn thành công' });
        }
    } catch (err) {
        return errRes(res, 'Lỗi khi thanh toán hóa đơn', err);
    }
}

// Gửi email hóa đơn
async function sendEmail(req, res) {
    try {
        const [invoiceRows] = await db.query(
            `SELECT i.*, c.email, c.full_name FROM invoices i 
             JOIN bookings b ON i.booking_id = b.booking_id 
             JOIN customers c ON b.customer_id = c.customer_id 
             WHERE i.invoice_id = ?`, 
            [req.params.id]
        );

        if (invoiceRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
        }

        const inv = invoiceRows[0];
        if (!inv.email) {
            return res.status(400).json({ message: 'Khách hàng này không có địa chỉ email' });
        }

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: inv.email,
                subject: `[Hotel Management] Hóa đơn thanh toán #${inv.invoice_id}`,
                html: `<div><h3>Xin chào ${inv.full_name},</h3><p>Đây là hóa đơn của bạn...</p></div>`
            });
            return res.json({ success: true, message: 'Đã gửi email hóa đơn thành công' });
        }
        return res.json({ success: true, message: 'Email định dạng demo (Chưa cấu hình tài khoản gửi)' });
    } catch (err) {
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