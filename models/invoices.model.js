const db = require('../config/db');

const InvoicesModel = {
    getAll: async (role, userId) => {
        let sql = `
            SELECT i.*, c.full_name as customer_name, c.email as customer_email, c.phone, 
                   r.room_number, r.room_type, b.check_in, b.check_out, b.total_nights, b.booking_group_id 
            FROM invoices i 
            JOIN bookings b ON i.booking_id = b.booking_id 
            JOIN customers c ON b.customer_id = c.customer_id 
            JOIN rooms r ON b.room_id = r.room_id
        `;
        let params = [];
        if (role === 'customer') {
            sql += " WHERE c.customer_id = ?";
            params.push(userId);
        }
        sql += " ORDER BY i.invoice_id DESC";
        const [rows] = await db.query(sql, params);
        return rows;
    },

    findById: async (id) => {
        const sql = `
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
        const [rows] = await db.query(sql, [id]);
        return rows[0] || null;
    },

    getServicesByBooking: async (bookingId) => {
        const servicesSql = `
            SELECT bs.service_id, s.service_name, bs.price, bs.quantity
            FROM booking_services bs
            JOIN services s ON bs.service_id = s.service_id
            WHERE bs.booking_id = ?
        `;
        const [rows] = await db.query(servicesSql, [bookingId]);
        return rows;
    },

    getGroupInvoices: async (bookingGroupId) => {
        const groupInvoicesSql = `
            SELECT i.*, r.room_number, r.room_type, b.booking_id
            FROM invoices i
            JOIN bookings b ON i.booking_id = b.booking_id
            JOIN rooms r ON b.room_id = r.room_id
            WHERE b.booking_group_id = ?
        `;
        const [rows] = await db.query(groupInvoicesSql, [bookingGroupId]);
        return rows;
    },

    getByBooking: async (bookingId) => {
        const [rows] = await db.query('SELECT * FROM invoices WHERE booking_id = ?', [bookingId]);
        return rows[0] || null;
    },

    updateStatus: async (id, paymentMethod) => {
        return await db.query(
            "UPDATE invoices SET status = 'paid', payment_method = ?, paid_at = NOW() WHERE invoice_id = ?", 
            [paymentMethod, id]
        );
    },

    getUnpaidGroupInvoices: async (bookingGroupId) => {
        const [rows] = await db.query(
            `SELECT i.invoice_id FROM invoices i 
             JOIN bookings b ON i.booking_id = b.booking_id 
             WHERE b.booking_group_id = ? AND i.status != 'paid'`,
            [bookingGroupId]
        );
        return rows;
    },

    updateGroupStatus: async (bookingGroupId, paymentMethod) => {
        return await db.query(
            `UPDATE invoices i
             JOIN bookings b ON i.booking_id = b.booking_id
             SET i.status = 'paid', i.payment_method = ?, i.paid_at = NOW()
             WHERE b.booking_group_id = ? AND i.status != 'paid'`,
            [paymentMethod, bookingGroupId]
        );
    },

    getEmailDetails: async (id) => {
        const [rows] = await db.query(
            `SELECT i.*, c.email, c.full_name FROM invoices i 
             JOIN bookings b ON i.booking_id = b.booking_id 
             JOIN customers c ON b.customer_id = c.customer_id 
             WHERE i.invoice_id = ?`, 
            [id]
        );
        return rows[0] || null;
    }
};

module.exports = InvoicesModel;
