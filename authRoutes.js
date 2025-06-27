// const express = require('express');
// const { signup, login } = require('./authController');

// const router = express.Router();

// router.post('/signup', signup);
// router.post('/login', login);

// module.exports = router;



const express = require('express');
const { signup, login } = require('./authController');
const verifyToken = require('./auth'); // Import your verifyToken middleware

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);

router.post('/validate', verifyToken, (req, res) => {

  res.json({ valid: true, message: 'Token is valid' });
});

module.exports = router;
