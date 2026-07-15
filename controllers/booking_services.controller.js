const BookingServicesService = require('../services/booking_services.service');

// Thêm dịch vụ vào đơn đặt phòng
async function addService(req, res) {
  try {
    const result = await BookingServicesService.addService(req.body);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "Lỗi hệ thống khi thêm dịch vụ", error: err.message });
  }
}

// Lấy danh sách dịch vụ của một phòng
async function getByBooking(req, res) {
  try {
    const data = await BookingServicesService.getByBooking(req.params.booking_id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: "Lỗi hệ thống khi tải dịch vụ phòng", error: err.message });
  }
}

module.exports = {
  addService,
  getByBooking
};