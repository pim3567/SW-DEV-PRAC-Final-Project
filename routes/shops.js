const express = require('express');
const { getShops,createShop, updateShop } = require('../controllers/shops');

const { createClosingDate, getClosingDates } = require('../controllers/specialClosingDates');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', getShops);
router.post('/', protect, authorize('admin'), createShop);
router.put('/:id', protect, authorize('admin'), updateShop);
router.get('/:shopId/closing-dates', protect, authorize('admin'), getClosingDates);
router.post('/:shopId/closing-dates', protect, authorize('admin'), createClosingDate);

module.exports = router;
