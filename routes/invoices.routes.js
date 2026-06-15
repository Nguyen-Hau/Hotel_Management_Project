const router = require('express').Router();
const c = require('../controllers/invoices.controller');
const { verifyToken, ROLES, requireRole } = require('../middleware/auth');

// Cho phép cả STAFF và CUSTOMER
const ALLOWED_ROLES = [...ROLES.STAFF, ...ROLES.CUSTOMER];

router.get('/', verifyToken, requireRole(ALLOWED_ROLES), c.getAll);
router.get('/booking/:id', verifyToken, requireRole(ALLOWED_ROLES), c.getByBooking);
router.get('/:id', verifyToken, requireRole(ALLOWED_ROLES), c.getById);  
router.put('/:id/pay', verifyToken, requireRole(ALLOWED_ROLES), c.pay);
router.post('/:id/email', verifyToken, requireRole(ALLOWED_ROLES), c.sendEmail);

module.exports = router;