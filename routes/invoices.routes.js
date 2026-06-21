const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoices.controller');
const authMiddleware = require('../middleware/auth');

const STAFF_ROLES = authMiddleware.ROLES.STAFF; 
const CUSTOMER_ROLES = authMiddleware.ROLES.CUSTOMER; 


const ALLOWED_ROLES = STAFF_ROLES.concat(CUSTOMER_ROLES);

router.get('/', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.getAll);
router.get('/booking/:id', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.getByBooking);
router.get('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.getById);  
router.put('/:id/pay', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.pay);
router.post('/:id/email', authMiddleware.verifyToken, authMiddleware.requireRole(ALLOWED_ROLES), invoiceController.sendEmail);

module.exports = router;