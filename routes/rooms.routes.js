const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const roomsController = require('../controllers/rooms.controller');
const upload = require('../middleware/upload');

const VIEW_ROLES = authMiddleware.ROLES.STAFF.concat(authMiddleware.ROLES.CUSTOMER);

// Lấy tất cả phòng (dành cho tất cả người dùng đã đăng nhập)
router.get('/', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), roomsController.getAll);
// Lấy thông tin phòng theo id (dành cho tất cả người dùng đã đăng nhập)
router.get('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), roomsController.getById);

// Các chức năng quản trị phòng dành riêng cho nhân viên/admin
// Thêm phòng mới (dành riêng cho admin)
router.post('/', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.ADMIN), upload.single('image'), roomsController.create);

// Cập nhật thông tin phòng (dành riêng cho admin)
router.put('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.ADMIN), upload.single('image'), roomsController.update);

// Xóa phòng (dành riêng cho admin)
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.ADMIN), roomsController.remove);

// Import danh sách phòng từ file Excel (dành riêng cho admin)
router.post('/import-excel', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.ADMIN), upload.single('excelFile'), roomsController.importExcel);

// Các chức năng dọn dẹp phòng (Housekeeping) dành cho nhân viên/admin
router.get('/housekeeping/list', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.STAFF), roomsController.getHousekeepingRooms);
router.put('/housekeeping/:id/start', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.STAFF), roomsController.startCleaning);
router.put('/housekeeping/:id/finish', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.STAFF), roomsController.finishCleaning);
router.put('/housekeeping/:id/confirm', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.STAFF), roomsController.confirmCleaned);

module.exports = router;