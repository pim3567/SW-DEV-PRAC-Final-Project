const mongoose = require('mongoose');

const MassageShopSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    tel: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    openingTime: { type: String, required: true },
    closingTime: { type: String, required: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('MassageShop', MassageShopSchema);