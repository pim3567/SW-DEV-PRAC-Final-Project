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
                error: err.message
            });
        }
        console.error(err);
        return res.status(500).json({
            success: false,
            error: 'Unable to create massage shop'
        });
    }

};

// @desc    Update a massage shop
// @route   PUT /api/shops/:id
// @access  Admin
exports.updateShop = async (req, res) => {
    try {
        const allowedFields = [
            'name',
            'address',
            'tel',
            'description',
            'openingTime',
            'closingTime'
        ];
        const updates = {};

        for (const field of allowedFields) {
            if (Object.hasOwn(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide shop fields to update'
            });
        }

        const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (
            (updates.openingTime && !timePattern.test(updates.openingTime)) ||
            (updates.closingTime && !timePattern.test(updates.closingTime))
        ) {
            return res.status(400).json({
                success: false,
                error: 'Invalid time format. Please use HH:mm format.'
            });
        }
        const shop = await Massage.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            {
                returnDocument: 'after',
                runValidators: true
            }
        );
        if (!shop) {
            return res.status(404).json({
                success: false,
                error: 'Massage shop not found'
            });
        }
        return res.status(200).json({
            success: true,
            data: shop
        });
    } catch(err) {
        if (err.name === 'ValidationError' || err.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid shop ID or data'
            });
        }
        console.error(err);
        return res.status(500).json({
            success: false,
            error: 'Unable to update massage shop'
        });
    }
};
