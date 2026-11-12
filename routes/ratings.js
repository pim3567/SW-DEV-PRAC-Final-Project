const express = require('express');
const { getRatings } = require('../controllers/ratings');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getRatings);

module.exports = router;
