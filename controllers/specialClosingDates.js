const SpecialClosingDate = require('../models/SpecialClosingDate');
const Massage = require('../models/MassageShop');

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

const handleError = (err, res, action) => {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
        return res.status(400).json({ success: false, error: 'Invalid ID or data' });
    }
    if (err.code === 11000) {
        return res.status(400).json({
            success: false,
            error: 'This shop already has a closing date on that day'
        });
    }
    console.error(err);
    return res.status(500).json({ success: false, error: `Unable to ${action}` });
};

// @desc    Create a special closing date for a shop
// @route   POST /api/v1/shops/:shopId/closing-dates
// @access  Admin
exports.createClosingDate = async (req, res) => {
    try {
        const { date, reason } = req.body;
        if (!isValidDate(date)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date. Please use a real date in YYYY-MM-DD format.'
            });
        }
        if (typeof reason !== 'string' || !reason.trim()) {
            return res.status(400).json({ success: false, error: 'Please provide a reason' });
        }
        const shop = await Massage.findById(req.params.shopId);
        if (!shop) {
            return res.status(404).json({ success: false, error: 'Massage shop not found' });
        }
        const closing = await SpecialClosingDate.create({
            shopId: shop._id,
            date,
            reason
        });
        return res.status(201).json({ success: true, data: closing });
    } catch (err) {
        return handleError(err, res, 'create special closing date');
    }
};

// @desc    List special closing dates of a shop
// @route   GET /api/v1/shops/:shopId/closing-dates
// @access  Admin
exports.getClosingDates = async (req, res) => {
    try {
        const shop = await Massage.findById(req.params.shopId);
        if (!shop) {
            return res.status(404).json({ success: false, error: 'Massage shop not found' });
        }
        const closings = await SpecialClosingDate.find({ shopId: shop._id }).sort({ date: 1 });
        return res.status(200).json({
            success: true,
            count: closings.length,
            data: closings
        });
    } catch (err) {
        return handleError(err, res, 'retrieve special closing dates');
    }
};

// @desc    Update a special closing date
// @route   PUT /api/v1/closing-dates/:id
// @access  Admin
exports.updateClosingDate = async (req, res) => {
    try {
        const updates = {};
        for (const field of ['date', 'reason']) {
            if (Object.hasOwn(req.body, field)) updates[field] = req.body[field];
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide date or reason to update'
            });
        }
        if (updates.date !== undefined && !isValidDate(updates.date)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date. Please use a real date in YYYY-MM-DD format.'
            });
        }
        if (
            updates.reason !== undefined &&
            (typeof updates.reason !== 'string' || !updates.reason.trim())
        ) {
            return res.status(400).json({ success: false, error: 'Reason cannot be empty' });
        }
        const closing = await SpecialClosingDate.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { returnDocument: 'after', runValidators: true }
        );
        if (!closing) {
            return res.status(404).json({ success: false, error: 'Special closing date not found' });
        }
        return res.status(200).json({ success: true, data: closing });
    } catch (err) {
        return handleError(err, res, 'update special closing date');
    }
};

// @desc    Delete a special closing date
// @route   DELETE /api/v1/closing-dates/:id
// @access  Admin
exports.deleteClosingDate = async (req, res) => {
    try {
        const closing = await SpecialClosingDate.findByIdAndDelete(req.params.id);
        if (!closing) {
            return res.status(404).json({ success: false, error: 'Special closing date not found' });
        }
        return res.status(200).json({ success: true, data: {} });
    } catch (err) {
        return handleError(err, res, 'delete special closing date');
    }
};
