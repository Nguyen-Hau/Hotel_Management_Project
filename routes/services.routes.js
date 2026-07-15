const router = require('express').Router();
const { verifyToken, ROLES, requireRole } = require('../middleware/auth');
const servicesController = require('../controllers/services.controller');

const checkStaff = requireRole(ROLES.STAFF);

// router
router.get('/', verifyToken, checkStaff, servicesController.getAll);
router.post('/', verifyToken, checkStaff, servicesController.create);
router.put('/:id', verifyToken, checkStaff, servicesController.update);
router.delete('/:id', verifyToken, requireRole(ROLES.ADMIN), servicesController.remove);
router.post('/booking', verifyToken, checkStaff, servicesController.addToBooking);
router.get('/booking/:booking_id', verifyToken, checkStaff, servicesController.getByBooking);
router.delete('/booking/:id', verifyToken, checkStaff, servicesController.removeFromBooking);

module.exports = router;