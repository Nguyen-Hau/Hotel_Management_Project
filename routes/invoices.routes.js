const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoices.controller');
const authMiddleware = require('../middleware/auth');

// Lấy ra danh sách các role hợp lệ
const STAFF_ROLES = authMiddleware.ROLES.STAFF; // Mảng các role nhân viên
const CUSTOMER_ROLES = authMiddleware.ROLES.CUSTOMER; // Mảng các role khách hàng

// Gộp các quyền truy cập bằng cách tạo mảng mới bình thường
const ALLOWED_ROLES = STAFF_ROLES.concat(CUSTOMER_ROLES);

router.get('/', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.getAll);
router.get('/booking/:id', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.getByBooking);
router.get('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.getById);  
router.put('/:id/pay', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.pay);
router.post('/:id/email', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.sendEmail);

module.exports = router;