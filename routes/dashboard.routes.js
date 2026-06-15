const router = require('express').Router();
const { verifyToken, ROLES, requireRole } = require('../middleware/auth');
const { getDashboard, getRecentActivities } = require('../controllers/dashboard.controller');

const ALLOWED_ROLES = [...ROLES.STAFF, ...ROLES.CUSTOMER];

router.get('/', verifyToken, requireRole(ALLOWED_ROLES), getDashboard);
router.get('/activities', verifyToken, requireRole(ROLES.STAFF), getRecentActivities);

module.exports = router;