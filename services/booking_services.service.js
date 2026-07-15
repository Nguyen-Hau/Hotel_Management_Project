const BookingServicesModel = require('../models/booking_services.model');

const BookingServicesService = {
    addService: async (body) => {
        const { booking_id, service_id, quantity } = body;
        const qty = quantity || 1;
        await BookingServicesModel.add(booking_id, service_id, qty);
        return { message: "Thêm dịch vụ thành công" };
    },

    getByBooking: async (bookingId) => {
        return await BookingServicesModel.getByBooking(bookingId);
    }
};

module.exports = BookingServicesService;
