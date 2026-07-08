const router = require('express').Router();
const { verifyToken, ROLES, requireRole } = require('../middleware/auth');
const { getDashboard, getRecentActivities, getCustomRevenue } = require('../controllers/dashboard.controller');

const ALLOWED_ROLES = [...ROLES.STAFF, ...ROLES.CUSTOMER];

router.get('/', verifyToken, requireRole(ALLOWED_ROLES), getDashboard);
router.get('/activities', verifyToken, requireRole(ROLES.STAFF), getRecentActivities);
router.get('/custom-revenue', verifyToken, requireRole(ROLES.STAFF), getCustomRevenue);

module.exports = router;