const router = require('express').Router();
const { verifyToken, ROLES, requireRole } = require('../middleware/auth');
const usersController = require('../controllers/users.controller');

const checkAdmin = requireRole(ROLES.ADMIN);

// router
router.get('/', verifyToken, checkAdmin, usersController.getAllUsers);
router.get('/:id', verifyToken, checkAdmin, usersController.getUserById);
router.post('/', verifyToken, checkAdmin, usersController.createUser);
router.put('/:id', verifyToken, checkAdmin, usersController.updateUser);
router.delete('/:id', verifyToken, checkAdmin, usersController.deleteUser);

module.exports = router;