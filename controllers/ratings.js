const mongoose = require('mongoose');
const Rating = require('../models/Rating');
const Reservation = require('../models/Reservation');

// @desc    Submit a rating for a completed reservation
// @route   POST /api/v1/reservations/:id/rating
// @access  Registered user who owns the reservation
exports.createRating = async (req, res) => {
    try {
        const { rating, comment } = req.body || {};
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be an integer from 1 to 5'
            });
        }
        if (comment !== undefined && (typeof comment !== 'string' || comment.length > 500)) {
            return res.status(400).json({
                success: false,
                error: 'Comment must be a string of at most 500 characters'
            });
        }
        if (!mongoose.isObjectIdOrHexString(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid reservation ID' });
        }

        const reservation = await Reservation.findById(req.params.id);
        if (!reservation || String(reservation.userId) !== String(req.user.id)) {
            return res.status(404).json({ success: false, error: 'Reservation not found' });
        }
        // Check if the reservation is completed
        const completed = reservation.status === 'completed';
        if (!completed) {
            return res.status(400).json({
                success: false,
                error: 'You can only rate a reservation after it has been completed'
            });
        }

        const created = await Rating.create({
            reservationId: reservation._id,
            userId: reservation.userId,
            shopId: reservation.shopId,
            rating,
            comment
        });
        return res.status(201).json({ success: true, data: created });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'This reservation has already been rated'
            });
        }
        if (err.name === 'ValidationError' || err.name === 'CastError') {
            return res.status(400).json({ success: false, error: 'Invalid rating data' });
        }
        console.error(err);
        return res.status(500).json({ success: false, error: 'Unable to submit rating' });
    }
};

// @desc    View all ratings (optionally filtered by ?shopId=)
// @route   GET /api/v1/ratings
// @access  Logged-in users and admins
exports.getRatings = async (req, res) => {
    try {
        const filter = {};
        if (req.query.shopId !== undefined) {
            if (!mongoose.isObjectIdOrHexString(req.query.shopId)) {
                return res.status(400).json({ success: false, error: 'Invalid shop ID' });
            }
            filter.shopId = req.query.shopId;
        }
        const ratings = await Rating.find(filter)
            .populate('shopId', 'name')
            .populate('userId', 'name')
            .sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            count: ratings.length,
            data: ratings
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'Unable to retrieve ratings' });
    }
};
