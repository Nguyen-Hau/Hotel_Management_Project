const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const roomsController = require('../controllers/rooms.controller');

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Gộp các quyền dành cho chức năng xem phòng
const VIEW_ROLES = authMiddleware.ROLES.STAFF.concat(authMiddleware.ROLES.CUSTOMER);

router.get('/', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), roomsController.getAll);
router.get('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), roomsController.getById);

// Các chức năng quản trị phòng dành riêng cho nhân viên/admin
router.post('/', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.STAFF), upload.single('image'), roomsController.create);
router.put('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.STAFF), upload.single('image'), roomsController.update);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.ADMIN), roomsController.remove);

module.exports = router;