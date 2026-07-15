const router = require("express").Router();
const c = require("../../backend/controllers/booking_services.controller");

// Thêm dịch vụ cho booking
router.post("/", c.addService);

// Lấy dịch vụ của 1 booking
router.get("/:booking_id", c.getByBooking);

module.exports = router;
