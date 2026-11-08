const Massage = require('../models/MassageShop');

// @desc    Get all massage shops
// @route   GET /api/massage-shops
// @access  Public
exports.getMassages = async (req, res) => {
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
