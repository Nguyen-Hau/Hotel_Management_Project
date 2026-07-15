const ServicesModel = require('../models/services.model');

const ServicesService = {
    getAll: async () => {
        return await ServicesModel.getAll();
    },

    create: async (body) => {
        const { service_name, price } = body;
        const insertId = await ServicesModel.create({ service_name, price });
        return { success: true, message: 'Thêm dịch vụ thành công', id: insertId };
    },

    update: async (id, body) => {
        const { service_name, price } = body;
        await ServicesModel.update(id, { service_name, price });
        return { success: true, message: 'Cập nhật dịch vụ thành công' };
    },

    remove: async (id) => {
        await ServicesModel.remove(id);
        return { success: true, message: 'Xóa dịch vụ thành công' };
    },

    addToBooking: async (body) => {
        const { booking_id, service_id, quantity, appointment_time } = body;
        const sv = await ServicesModel.findById(service_id);
        if (!sv) {
            throw new Error('SERVICE_NOT_FOUND');
        }

        const qty = quantity || 1;
        const time = appointment_time || null;

        const insertId = await ServicesModel.addServiceToBooking(booking_id, service_id, qty, sv.price, time);
        return { success: true, message: 'Đã thêm dịch vụ vào đơn đặt phòng thành công', id: insertId };
    },

    getByBooking: async (bookingId) => {
        return await ServicesModel.getServicesByBooking(bookingId);
    },

    removeFromBooking: async (id) => {
        await ServicesModel.removeServiceFromBooking(id);
        return { success: true, message: 'Đã hủy dịch vụ khỏi phòng này' };
    }
};

module.exports = ServicesService;
