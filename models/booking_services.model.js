const db = require('../config/db');

const BookingServicesModel = {
    add: async (booking_id, service_id, quantity) => {
        const sql = "INSERT INTO booking_services (booking_id, service_id, quantity) VALUES (?, ?, ?)";
        return await db.query(sql, [booking_id, service_id, quantity]);
    },

    getByBooking: async (booking_id) => {
        const sql = `
            SELECT 
              s.service_name,
              s.price,
              bs.quantity,
              (s.price * bs.quantity) AS total
            FROM booking_services bs
            JOIN services s ON bs.service_id = s.service_id
            WHERE bs.booking_id = ?
        `;
        const [rows] = await db.query(sql, [booking_id]);
        return rows;
    }
};

module.exports = BookingServicesModel;
