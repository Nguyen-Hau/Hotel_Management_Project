const db = require('../config/db'), nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });

const errRes = (res, msg, err) => (console.error(msg, err), res.status(500).json({ message: msg + (err?.message ? ': ' + err.message : '') }));
const fDt = d => d ? new Date(d).toLocaleDateString('vi-VN') : 'Chưa xác định';

exports.getAll = async (req, res) => {
    try {
        let sql = 
        `SELECT i.*, c.full_name as customer_name, c.email as customer_email, c.phone, r.room_number, r.room_type, b.check_in, b.check_out, b.total_nights 
        FROM invoices i 
        JOIN bookings b ON i.booking_id = b.booking_id 
        JOIN customers c ON b.customer_id = c.customer_id 
        JOIN rooms r ON b.room_id = r.room_id`;
        const params = req.user.role === 'customer' ? [req.user.id] : [];
        if (params.length) sql += " WHERE c.customer_id = ?";
        const [rows] = await db.query(sql + " ORDER BY i.invoice_id DESC", params);
        return res.json(rows);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy danh sách hóa đơn', err); 
    }
};

exports.getById = async (req, res) => {
    try {
        const [inv] = await db.query(
            `SELECT i.*, c.full_name as customer_name, c.email as customer_email, c.phone, r.room_number, r.room_type, b.check_in, b.check_out, b.total_nights 
            FROM invoices i 
             bookings b ON i.booking_id = b.booking_id 
             JOIN customers c ON b.customer_id = c.customer_id 
             JOIN rooms r ON b.room_id = r.room_id 
             WHERE i.invoice_id = ?`, 
             [req.params.id]
        );
        if (!inv.length) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
        const [sv] = await db.query(
            `SELECT s.service_name, s.price, bs.quantity, (s.price * bs.quantity) as total, bs.appointment_time 
            FROM booking_services bs JOIN services s ON bs.service_id = s.service_id 
            WHERE bs.booking_id = ?`, 
            [inv[0].booking_id]
        );
        return res.json({ ...inv[0], services: sv });
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy thông tin hóa đơn', err); 
    }
};

exports.getByBooking = async (req, res) => {
    try {
        const [inv] = await db.query(
            'SELECT * FROM invoices WHERE booking_id = ?', [req.params.id]
        );
        return inv.length ? res.json(inv[0]) : res.status(200).json({ exists: false, total_amount: 0, message: 'Chưa có hóa đơn cho booking này' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy hóa đơn', err); 
    }
};

exports.pay = async (req, res) => {
    try {
        const [r] = await db.query(
            `UPDATE invoices 
            SET status = 'paid', payment_method = ?, paid_at = NOW() 
            WHERE invoice_id = ? AND status = 'unpaid'`, 
            [req.body.payment_method, req.params.id]
        );
        return r.affectedRows ? res.json({ 
            success: true, message: 'Thanh toán thành công' }) : res.status(404).json({ message: 'Không tìm thấy hóa đơn hoặc đã được thanh toán' });
    } catch (err) { 
        return errRes(res, 'Lỗi khi thanh toán', err); 
    }
};

exports.sendEmail = async (req, res) => {
    try {
        const [invs] = await db.query(
            `SELECT i.*, c.full_name, c.email, r.room_number, r.room_type, b.check_in, b.check_out 
            FROM invoices i 
            JOIN bookings b ON i.booking_id = b.booking_id 
            JOIN customers c ON b.customer_id = c.customer_id
            JOIN rooms r ON b.room_id = r.room_id WHERE i.invoice_id = ?`, 
            [req.params.id]
        );
        if (!invs.length) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
        const inv = invs[0];

        const [svs] = await db.query(
            `SELECT s.service_name, s.price, bs.quantity 
            FROM booking_services bs 
            JOIN services s ON bs.service_id = s.service_id 
            WHERE bs.booking_id = ?`, 
            [inv.booking_id]
        );
        const svHtml = svs.length ? 
        `<table style="width:100%; border-collapse: collapse; margin: 10px 0;">
        <tr style="background: #f2f2f2;">
            <th style="padding: 8px; text-align: left;">Dịch vụ</th>
            <th style="padding: 8px; text-align: center;">Số lượng</th>
            <th style="padding: 8px; text-align: right;">Thành tiền</th>
        </tr>${svs.map(s => `<tr>
        <td style="padding: 8px;">${s.service_name}</td>
            <td style="padding: 8px; text-align: center;">${s.quantity}</td>
            <td style="padding: 8px; text-align: right;">${(s.price * s.quantity).toLocaleString('vi-VN')} VND</td>
        </tr>`).join('')}</table>` : '<p>Không có dịch vụ</p>';

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail({
                from: process.env.EMAIL_USER, to: inv.email, subject: `Hóa đơn #${inv.invoice_id} - Hotel Management`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2d89ef; text-align: center;">🏨 HÓA ĐƠN THANH TOÁN</h2>
                    <p>
                        <strong>Mã hóa đơn:</strong> #${inv.invoice_id}</p>
                    <p>
                        <strong>Khách hàng:</strong> ${inv.full_name}</p>
                    <p>
                        <strong>Phòng:</strong> ${inv.room_number} (${inv.room_type})</p>
                    <p>
                        <strong>Ngày nhận phòng:</strong> ${fDt(inv.check_in)}</p>
                    <p>
                        <strong>Ngày trả phòng:</strong> ${fDt(inv.check_out)}</p>
                        <h3>Chi tiết thanh toán:</h3>
                    <p>
                        <strong>Tiền phòng:</strong> ${inv.room_amount.toLocaleString('vi-VN')} VND</p>
                    <p>
                        <strong>Dịch vụ:</strong></p>${svHtml}
                    <p>
                        <strong>Tiền dịch vụ:</strong> ${inv.service_amount.toLocaleString('vi-VN')} VND</p>
                    <hr>
                    <p>
                        <strong style="font-size: 18px;">Tổng cộng:</strong> 
                        <strong style="font-size: 18px; color: #dc3545;">${inv.total_amount.toLocaleString('vi-VN')} VND</strong></p>
                    <p>
                        <strong>Trạng thái:</strong> ${inv.status === 'paid' ? '✅ Đã thanh toán' : '⏳ Chưa thanh toán'}</p>
                    <p>
                        <strong>Ngày tạo:</strong> ${new Date(inv.created_at).toLocaleString('vi-VN')}</p>${inv.paid_at ? `
                    <p>
                        <strong>Ngày thanh toán:</strong> ${new Date(inv.paid_at).toLocaleString('vi-VN')}</p>` : ''}
                    <hr>
                    <p style="color: #666; font-size: 12px; text-align: center;">Cảm ơn quý khách đã sử dụng dịch vụ của chúng tôi!</p></div>`
            });
            return res.json({ success: true, message: 'Đã gửi email hóa đơn thành công' });
        }
        return res.json({ success: true, message: 'Email demo (chưa cấu hình email)' });
    } catch (err) { return errRes(res, 'Lỗi khi gửi email', err); }
};