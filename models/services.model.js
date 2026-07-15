const db = require('../config/db');

const ServicesModel = {
    getAll: async () => {
        const [rows] = await db.query('SELECT * FROM services ORDER BY service_id');
        return rows;
    },

    findById: async (id) => {
        const [rows] = await db.query('SELECT * FROM services WHERE service_id = ?', [id]);
        return rows[0] || null;
    },

    create: async (data) => {
        const { service_name, price } = data;
        const [result] = await db.query(
            'INSERT INTO services (service_name, price) VALUES (?, ?)', 
            [service_name, price]
        );
        return result.insertId;
    },

    update: async (id, data) => {
        const { service_name, price } = data;
        return await db.query(
            'UPDATE services SET service_name = ?, price = ? WHERE service_id = ?', 
            [service_name, price, id]
        );
    },

    remove: async (id) => {
        return await db.query('DELETE FROM services WHERE service_id = ?', [id]);
    },

    addServiceToBooking: async (booking_id, service_id, quantity, price, appointment_time) => {
        const [result] = await db.query(
            'INSERT INTO booking_services (booking_id, service_id, quantity, price, appointment_time) VALUES (?, ?, ?, ?, ?)', 
            [booking_id, service_id, quantity, price, appointment_time]
        );
        return result.insertId;
    },

    getServicesByBooking: async (booking_id) => {
        const sql = `
            SELECT bs.id, bs.booking_id, bs.service_id, s.service_name, s.price, bs.quantity, 
                   (s.price * bs.quantity) AS total, bs.appointment_time, bs.created_at 
            FROM booking_services bs 
            JOIN services s ON bs.service_id = s.service_id 
            WHERE bs.booking_id = ?
        `;
        const [rows] = await db.query(sql, [booking_id]);
        return rows;
    },

    removeServiceFromBooking: async (id) => {
        return await db.query('DELETE FROM booking_services WHERE id = ?', [id]);
    }
};

module.exports = ServicesModel;
