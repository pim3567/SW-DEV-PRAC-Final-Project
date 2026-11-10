const mongoose = require('mongoose');

const SpecialClosingDateSchema = new mongoose.Schema({
    shopId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MassageShop',
        required: true
    },
    date: {
        type: String,
        required: true,
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
    },
    reason: { type: String, required: true, trim: true }
}, { timestamps: true });

SpecialClosingDateSchema.index({ shopId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('SpecialClosingDate', SpecialClosingDateSchema);
