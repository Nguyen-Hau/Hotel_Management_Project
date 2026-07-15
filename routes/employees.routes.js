const router = require('express').Router();
const { verifyToken, ROLES, requireRole } = require('../middleware/auth');
const employeesController = require('../controllers/employees.controller');

router.get('/', verifyToken, requireRole(ROLES.ADMIN), employeesController.getAll);
router.post('/', verifyToken, requireRole(ROLES.ADMIN), employeesController.create);
router.put('/:id', verifyToken, requireRole(ROLES.ADMIN), employeesController.update);
router.delete('/:id', verifyToken, requireRole(ROLES.ADMIN), employeesController.remove);

module.exports = router;