const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const customersController = require('../controllers/customers.controller');

const VIEW_ROLES = authMiddleware.ROLES.STAFF.concat(authMiddleware.ROLES.CUSTOMER);

router.get('/', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), customersController.getAll);
router.get('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), customersController.getById);
router.put('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), customersController.update);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.STAFF), customersController.remove);

module.exports = router;