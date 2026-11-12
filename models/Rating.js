const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema({
    reservationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reservation',
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    shopId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MassageShop',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: { validator: Number.isInteger, message: 'Rating must be an integer' }
    },
    comment: { type: String, trim: true, maxlength: 500 }
}, { timestamps: true });

RatingSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model('Rating', RatingSchema);
