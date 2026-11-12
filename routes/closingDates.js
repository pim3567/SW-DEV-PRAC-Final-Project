const express = require('express');
const { updateClosingDate, deleteClosingDate } = require('../controllers/specialClosingDates');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.put('/:id', protect, authorize('admin'), updateClosingDate);
router.delete('/:id', protect, authorize('admin'), deleteClosingDate);

module.exports = router;
