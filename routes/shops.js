const express = require('express');
const { getMassages } = require('../controllers/shops');

const router = express.Router();

router.get('/', getMassages);

module.exports = router;
