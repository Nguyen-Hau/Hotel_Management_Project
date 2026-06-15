const router = require('express').Router();
const multer = require('multer');
const { verifyToken, ROLES, requireRole } = require('../middleware/auth');
const { getAll, getById, create, update, remove } = require('../controllers/rooms.controller');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Cho phép customer xem danh sách phòng
router.get('/', verifyToken, requireRole([...ROLES.STAFF, ...ROLES.CUSTOMER]), getAll);
router.get('/:id', verifyToken, requireRole([...ROLES.STAFF, ...ROLES.CUSTOMER]), getById);
router.post('/', verifyToken, requireRole(ROLES.STAFF), upload.single('image'), create);
router.put('/:id', verifyToken, requireRole(ROLES.STAFF), upload.single('image'), update);
router.delete('/:id', verifyToken, requireRole(ROLES.ADMIN), remove);

module.exports = router;