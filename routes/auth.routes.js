const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Đăng nhập và đăng ký
router.post('/login', authController.login);
router.post('/register', authController.register);

module.exports = router;