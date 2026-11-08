const express = require('express');
const { getShops,createShop } = require('../controllers/shops');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', getShops);
router.post('/', protect, authorize('admin'), createShop);

module.exports = router;
