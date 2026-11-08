const Massage = require('../models/MassageShop');

// @desc    Get all massage shops
// @route   GET /api/massage-shops
// @access  Public
exports.getShops = async (req, res) => {
    try {
        const shops = await Massage.find().sort({name: 1});
        res.status(200).json({
            success: true,
            count: shops.length,
            data: shops
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Unable to retrieve massage shops'
        });
    }
}

// @desc    Create a new massage shop
// @route   POST /api/massage-shops
// @access  Admin
exports.createShop = async (req, res) => {
    try {
        const {
            name,
            address,
            tel,
            description,
            openingTime,
            closingTime
        } = req.body;

        const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timePattern.test(openingTime) || !timePattern.test(closingTime)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid time format. Please use HH:mm format.'
            });
        }
        const shop = await Massage.create({
            name,
            address,
            tel,
            description,
            openingTime,
            closingTime
        });
        res.status(201).json({
            success: true,
            data: shop
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: messages
            });
        }
        console.error(err);
        return res.status(500).json({
            success: false,
            error: 'Unable to create massage shop'
        });
    }

};