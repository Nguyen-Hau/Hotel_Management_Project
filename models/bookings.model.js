const db = require('../config/db');

const BookingsModel = {
    getAll: async (role, userId) => {
        let sql = 'SELECT b.*, c.full_name as customer_name, r.room_number, r.price as room_price, r.room_type FROM bookings b JOIN customers c ON b.customer_id = c.customer_id JOIN rooms r ON b.room_id = r.room_id';
        const params = [];

        if (role === 'customer') {
            params.push(userId);
            sql += ' WHERE b.customer_id = ?';
        }
        
        const [bookings] = await db.query(sql + ' ORDER BY b.booking_id DESC', params);
        return bookings;
    },

    getInvoiceTotalByBooking: async (bookingId) => {
        const [inv] = await db.query('SELECT total_amount FROM invoices WHERE booking_id = ?', [bookingId]);
        return inv[0] ? inv[0].total_amount : 0;
    },

    findById: async (id, conn = db) => {
        const [rows] = await conn.query(
            `SELECT b.*, c.full_name as customer_name, c.email, c.phone, c.cccd,
                    r.room_number, r.price as room_price, r.room_type 
             FROM bookings b 
             JOIN customers c ON b.customer_id = c.customer_id 
             JOIN rooms r ON b.room_id = r.room_id 
             WHERE b.booking_id = ?`,
            [id]
        );
        return rows[0] || null;
    },

    getOverlapping: async (roomId, checkIn, checkOut, excludeBookingId = null, conn = db) => {
        let sql = `
            SELECT b.booking_id, b.check_in, b.check_out, c.full_name
            FROM bookings b
            JOIN customers c ON b.customer_id = c.customer_id
            WHERE b.room_id = ?
              AND b.status IN ('booked', 'checked_in')
              AND IFNULL(b.check_out, DATE_ADD(b.check_in, INTERVAL 1 DAY)) > ?
              AND b.check_in < ?
        `;
        const params = [roomId, checkIn, checkOut];
        if (excludeBookingId) {
            sql += ' AND b.booking_id != ?';
            params.push(excludeBookingId);
        }
        const [rows] = await conn.query(sql, params);
        return rows;
    },

    create: async (customer_id, room_id, check_in, check_out, nights, booking_group_id, conn = db) => {
        const [result] = await conn.query(
            'INSERT INTO bookings (customer_id, room_id, check_in, check_out, total_nights, status, booking_group_id) VALUES (?, ?, ?, ?, ?, "booked", ?)',
            [customer_id, room_id, check_in, check_out || null, nights, booking_group_id]
        );
        return result.insertId;
    },

    updateStatus: async (bookingId, status, conn = db) => {
        return await conn.query('UPDATE bookings SET status = ? WHERE booking_id = ?', [status, bookingId]);
    },

    updateStatusAndNights: async (bookingId, status, nights, conn = db) => {
        return await conn.query('UPDATE bookings SET status = ?, total_nights = ? WHERE booking_id = ?', [status, nights, bookingId]);
    },

    getServicesTotalAmount: async (bookingId, conn = db) => {
        const [rows] = await conn.query(
            'SELECT IFNULL(SUM(s.price * bs.quantity), 0) as total FROM booking_services bs JOIN services s ON bs.service_id = s.service_id WHERE bs.booking_id = ?',
            [bookingId]
        );
        return rows[0] ? Number(rows[0].total) : 0;
    },

    getBookingGroup: async (groupId, status, conn = db) => {
        const [rows] = await conn.query(
            'SELECT b.*, r.price as room_price, r.room_id FROM bookings b JOIN rooms r ON b.room_id = r.room_id WHERE b.booking_group_id = ? AND b.status = ?',
            [groupId, status]
        );
        return rows;
    },

    updateInvoice: async (bookingId, roomAmount, serviceAmount, total, surcharges, conn = db) => {
        const [exist] = await conn.query('SELECT invoice_id FROM invoices WHERE booking_id = ?', [bookingId]);
        const { checkin_early, checkout_late, extra_people, extra_bed, description } = surcharges;

        if (exist.length > 0) {
            await conn.query(
                `UPDATE invoices 
                 SET room_amount = ?, service_amount = ?, total_amount = ?, 
                     surcharge_checkin_early = ?, surcharge_checkout_late = ?, 
                     surcharge_extra_people = ?, surcharge_extra_bed = ?, 
                     surcharge_description = ? 
                 WHERE booking_id = ?`,
                [roomAmount, serviceAmount, total, checkin_early, checkout_late, extra_people, extra_bed, description, bookingId]
            );
            return exist[0].invoice_id;
        } else {
            const [insertRes] = await conn.query(
                `INSERT INTO invoices 
                 (booking_id, room_amount, service_amount, total_amount, status, 
                  surcharge_checkin_early, surcharge_checkout_late, surcharge_extra_people, 
                  surcharge_extra_bed, surcharge_description) 
                 VALUES (?, ?, ?, ?, "unpaid", ?, ?, ?, ?, ?)`,
                [bookingId, roomAmount, serviceAmount, total, checkin_early, checkout_late, extra_people, extra_bed, description]
            );
            return insertRes.insertId;
        }
    },

    extend: async (bookingId, checkOut, nights, conn = db) => {
        return await conn.query(
            'UPDATE bookings SET check_out = ?, total_nights = ? WHERE booking_id = ?',
            [checkOut, nights, bookingId]
        );
    }
};

module.exports = BookingsModel;
