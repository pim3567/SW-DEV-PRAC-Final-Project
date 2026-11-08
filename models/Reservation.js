const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
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
    reservationDate: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true,
        match: /^([01]\d|2[0-3]):([0-5]\d)$/
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed','cancelled'],
        default: 'pending'
    }
}, {
    timestamps: true
});

ReservationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Reservation', ReservationSchema);
