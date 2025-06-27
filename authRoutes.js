const express = require('express');
const { signup, login, validateToken, resetPasswordRequest, resetPassword } = require('./authController');
const verifyToken = require('./auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/validate', verifyToken, validateToken);
router.post('/reset-password-request', resetPasswordRequest);
router.post('/reset-password', resetPassword);

module.exports = router;