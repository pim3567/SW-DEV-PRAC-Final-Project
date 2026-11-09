const express = require('express');
const multer = require('multer');
const { getMyReservations, getReservation, createReservation, updateReservation, deleteReservation } = require('../controllers/reservation');

const { protect } = require('../middleware/auth');

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
router.delete('/:id', protect, deleteReservation);

module.exports = router;
