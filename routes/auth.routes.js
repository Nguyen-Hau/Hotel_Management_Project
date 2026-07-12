const express = require('express');
const authController = require('../controllers/auth.controller');
const router = express.Router();

// Đăng nhập và đăng ký tài khoản
router.post('/login', authController.login);
router.post('/register', authController.register);

module.exports = router;