const express = require('express');
const multer = require('multer');
const { getMyReservations, getReservation, createReservation, updateReservation, updateReservationStatus, deleteReservation } = require('../controllers/reservation');

const { protect } = require('../middleware/auth');
const { createRating } = require('../controllers/ratings');

const router = express.Router();

const parseForm = multer({
    limits: {
        fields: 10,
        fieldSize: 4096,
        files: 0
    }
}).none();

const parseReservationForm = (req, res, next) => {
    parseForm(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                error: 'Invalid multipart form data'
            });
        }
        next();
    });
};

router.get('/', protect, getMyReservations);
router.get('/:id', protect, getReservation);
router.post('/', protect, parseReservationForm, createReservation);
router.put('/:id', protect, parseReservationForm, updateReservation);
router.patch('/:id/status', protect, parseReservationForm, updateReservationStatus);
router.delete('/:id', protect, deleteReservation);
router.post('/:id/rating', protect, createRating);

module.exports = router;
