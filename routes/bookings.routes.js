const router = require('express').Router();
const { verifyToken, ROLES, requireRole } = require('../middleware/auth');
const bookingsController = require('../controllers/bookings.controller'); // Import controller vào

// Gộp mảng quyền hạn bằng cách concat truyền thống
const authRoles = requireRole(ROLES.STAFF.concat(ROLES.CUSTOMER));

// Lấy danh sách đặt phòng
router.get('/', verifyToken, authRoles, bookingsController.getAll);

// Lấy chi tiết một đơn đặt phòng
router.get('/:id', verifyToken, authRoles, bookingsController.getById);

// Tạo đơn đặt phòng mới
router.post('/', verifyToken, authRoles, bookingsController.create);

// Nhân viên thực hiện Check-in
router.put('/checkin/:id', verifyToken, requireRole(ROLES.STAFF), bookingsController.checkIn);

// Nhân viên thực hiện Check-out
router.put('/checkout/:id', verifyToken, requireRole(ROLES.STAFF), bookingsController.checkOut);

// Hủy đơn đặt phòng
router.put('/cancel/:id', verifyToken, authRoles, bookingsController.cancel);

module.exports = router;