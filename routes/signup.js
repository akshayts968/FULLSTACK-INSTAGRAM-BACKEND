const express = require('express');
const passport = require('passport');
const { signup } = require('../controllers/authController');

const router = express.Router();

router.post('/', signup);


module.exports = router;
