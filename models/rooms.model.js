const db = require('../config/db');

const RoomsModel = {
    getAll: async () => {
        const [rooms] = await db.query('SELECT * FROM rooms ORDER BY room_number');
        return rooms;
    },

    getAvailable: async (checkIn, checkOut) => {
        const [rooms] = await db.query(
            `SELECT r.* FROM rooms r 
             WHERE r.status != 'maintenance' 
               AND r.room_id NOT IN (
                   SELECT b.room_id FROM bookings b 
                   WHERE b.status IN ('booked', 'checked_in') 
                     AND IFNULL(b.check_out, DATE_ADD(b.check_in, INTERVAL 1 DAY)) > ? 
                     AND b.check_in < ?
               )
             ORDER BY r.room_number`,
            [checkIn, checkOut]
        );
        return rooms;
    },

    findById: async (id) => {
        const [room] = await db.query('SELECT * FROM rooms WHERE room_id = ?', [id]);
        return room[0] || null;
    },

    findByRoomNumber: async (roomNumber) => {
        const [room] = await db.query('SELECT * FROM rooms WHERE room_number = ?', [roomNumber]);
        return room[0] || null;
    },

    create: async (roomData) => {
        const { room_number, room_type, price, image, services, status } = roomData;
        const [result] = await db.query(
            'INSERT INTO rooms (room_number, room_type, price, image, services, status) VALUES (?, ?, ?, ?, ?, ?)',
            [room_number, room_type, price, image, services, status]
        );
        return result.insertId;
    },

    update: async (id, roomData) => {
        const { room_number, room_type, price, image, services, status } = roomData;
        return await db.query(
            'UPDATE rooms SET room_number = ?, room_type = ?, price = ?, image = ?, services = ?, status = ? WHERE room_id = ?',
            [room_number, room_type, price, image, services, status, id]
        );
    },

    updateBasicFromExcel: async (roomNumber, roomType, price, status) => {
        return await db.query(
            'UPDATE rooms SET room_type = ?, price = ?, status = ? WHERE room_number = ?',
            [roomType, price, status, roomNumber]
        );
    },

    insertFromExcel: async (roomNumber, roomType, price, status) => {
        return await db.query(
            'INSERT INTO rooms (room_number, room_type, price, status) VALUES (?, ?, ?, ?)',
            [roomNumber, roomType, price, status]
        );
    },

    remove: async (id) => {
        return await db.query('DELETE FROM rooms WHERE room_id = ?', [id]);
    },

    getHousekeeping: async () => {
        const [rooms] = await db.query(
            "SELECT * FROM rooms WHERE status IN ('dirty', 'cleaning', 'inspected') ORDER BY room_number"
        );
        return rooms;
    },

    updateStatus: async (id, status) => {
        return await db.query("UPDATE rooms SET status = ? WHERE room_id = ?", [status, id]);
    }
};

module.exports = RoomsModel;
