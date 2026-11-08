const express = require('express');
const { getShops,createShop, updateShop } = require('../controllers/shops');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', getShops);
router.post('/', protect, authorize('admin'), createShop);
router.put('/:id', protect, authorize('admin'), updateShop);

module.exports = router;
