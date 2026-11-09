const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const MassageShop = require("../models/MassageShop");
const User = require("../models/User");
const { sendEmail } = require("../utils/sendEmail");

// @desc View my reservations, or all reservations as admin
// @route GET /api/v1/reservations
// @access Logged-in users
exports.getMyReservations = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "admin") {
      filter.userId = req.user.id;
    }
    const reservations = await Reservation.find(filter)
      .populate("shopId", "name address tel")
      .populate("userId", "name email")
      .sort({ reservationDate: 1, startTime: 1 });
    return res.status(200).json({
      success: true,
      count: reservations.length,
      data: reservations,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "Unable to retrieve reservations",
    });
  }
};

// @desc    View one reservation
// @route   GET /api/v1/reservations/:id
// @access  Reservation owner or admin
exports.getReservation = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid reservation ID",
      });
    }

    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: "Reservation not found",
      });
    }
    if (
      reservation.userId.toString() !== req.user.id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view this reservation",
      });
    }

    const details = await reservation.populate([
      { path: "shopId", select: "name address tel openingTime closingTime" },
      { path: "userId", select: "name email" },
    ]);
    return res.status(200).json({
      success: true,
      data: details,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid reservation ID",
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "Unable to retrieve reservation",
    });
  }
};

// @desc Create a new reservation
// @route POST /api/v1/reservations
// @access Logged-in users
exports.createReservation = async (req, res) => {
  try {
    const { shopId, reservationDate, startTime } = req.body || {};
    if (!shopId || !reservationDate || !startTime) {
      return res.status(400).json({
        success: false,
        error: "Please provide shopId, reservationDate, and startTime",
      });
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof reservationDate !== "string" || !datePattern.test(reservationDate)) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format. Please use YYYY-MM-DD format.",
      });
    }
    const dateOnly = new Date(`${reservationDate}T00:00:00Z`);
    if (
      Number.isNaN(dateOnly.getTime()) ||
      dateOnly.toISOString().slice(0, 10) !== reservationDate
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid reservation date",
      });
    }
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (typeof startTime !== "string" || !timePattern.test(startTime)) {
      return res.status(400).json({
        success: false,
        error: "Invalid time format. Please use HH:mm format.",
      });
    }
    const bookingDate = new Date(`${reservationDate}T${startTime}:00+07:00`);
    if (bookingDate.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: "Reservation date and time must be in the future",
      });
    }
    if (!mongoose.isObjectIdOrHexString(shopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid shop ID",
      });
    }
    const shop = await MassageShop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: "Massage shop not found",
      });
    }
    if (startTime < shop.openingTime || startTime >= shop.closingTime) {
      return res.status(400).json({
        success: false,
        error: `Reservation time must be within the shop's operating hours: ${shop.openingTime} - ${shop.closingTime}`,
      });
    }
    const reservation = await mongoose.connection.transaction(async (session) => {
      // Write to the same user first so concurrent bookings conflict and retry.
      // The count and insert must use this session after acquiring the user lock.
      const user = await User.updateOne(
        { _id: req.user.id },
        { $inc: { reservationVersion: 1 } },
        { session },
      );
      if (user.matchedCount === 0) {
        const error = new Error("User no longer exists");
        error.code = "RESERVATION_USER_NOT_FOUND";
        throw error;
      }

      const reservationCount = await Reservation.countDocuments({
        userId: req.user.id,
        status: { $in: ["pending", "confirmed"] },
      }).session(session);
      if (reservationCount >= 3) {
        const error = new Error("You can have at most 3 active reservations");
        error.code = "RESERVATION_LIMIT";
        throw error;
      }

      const reservations = await Reservation.create([{
        userId: req.user.id,
        shopId: shop._id,
        reservationDate: bookingDate,
        startTime,
        status: "pending",
      }], { session });
      return reservations[0];
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
    // Send only after commit, so transaction retries cannot duplicate the email.
    if (req.user.role === "user") {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
      if (!adminEmail) {
        console.error("Admin notification email skipped: ADMIN_NOTIFICATION_EMAIL is not configured");
      } else {
        const bookingTime = reservation.reservationDate.toLocaleString(
          "en-GB",
          { timeZone: "Asia/Bangkok" },
        );

        // Email delivery runs independently of the successful booking response.
        sendEmail({
          to: adminEmail,
          subject: "New Massage Reservation",
          text: [
            "A customer has successfully made a reservation.",
            "",
            `Reservation ID: ${reservation._id}`,
            `Customer: ${req.user.name}`,
            `Customer email: ${req.user.email}`,
            `Massage shop: ${shop.name}`,
            `Booking time: ${bookingTime} (Thailand time)`,
            `Status: ${reservation.status}`,
          ].join("\n"),
        }).catch((err) => {
          console.error("Admin notification email failed:", err.code || "UNKNOWN");
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: reservation,
    });
  } catch (err) {
    if (err.code === "RESERVATION_USER_NOT_FOUND") {
      return res.status(401).json({
        success: false,
        error: err.message,
      });
    }
    if (
      err.code === "RESERVATION_LIMIT" ||
      err.name === "ValidationError" ||
      err.name === "CastError"
    ) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "Unable to create reservation",
    });
  }
};

// @desc    Edit my reservation, or any reservation as admin
// @route   PUT /api/v1/reservations/:id
// @access  Reservation owner or admin
exports.updateReservation = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid reservation ID",
      });
    }
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: "Reservation not found",
      });
    }
    if (
      reservation.userId.toString() !== req.user.id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this reservation",
      });
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        error: "Please provide shopId, reservationDate, or startTime to update",
      });
    }

    const allowedFields = ["shopId", "reservationDate", "startTime"];
    const updates = {};

    for (const field of allowedFields) {
      if (Object.hasOwn(body, field)) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide shopId, reservationDate, or startTime to update",
      });
    }

    // Stored timestamps are UTC; recover the booking's calendar day in Thailand.
    const localDate = new Date(
      reservation.reservationDate.getTime() + 7 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);
    const reservationDate = Object.hasOwn(updates, "reservationDate")
      ? updates.reservationDate
      : localDate;
    const startTime = Object.hasOwn(updates, "startTime")
      ? updates.startTime
      : reservation.startTime;
    const shopId = Object.hasOwn(updates, "shopId")
      ? updates.shopId
      : reservation.shopId;

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (
      typeof reservationDate !== "string" ||
      !datePattern.test(reservationDate)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format. Please use YYYY-MM-DD.",
      });
    }
    const dateOnly = new Date(`${reservationDate}T00:00:00Z`);
    if (
      Number.isNaN(dateOnly.getTime()) ||
      dateOnly.toISOString().slice(0, 10) !== reservationDate
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid reservation date",
      });
    }
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (typeof startTime !== "string" || !timePattern.test(startTime)) {
      return res.status(400).json({
        success: false,
        error: "Invalid time format. Please use HH:mm.",
      });
    }
    const bookingDate = new Date(`${reservationDate}T${startTime}:00+07:00`);
    if (bookingDate.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: "Reservation date and time must be in the future",
      });
    }
    if (!mongoose.isObjectIdOrHexString(shopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid shop ID",
      });
    }
    const shop = await MassageShop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: "Massage shop not found",
      });
    }
    if (startTime < shop.openingTime || startTime >= shop.closingTime) {
      return res.status(400).json({
        success: false,
        error: `Reservation time must be within the shop's operating hours: ${shop.openingTime} - ${shop.closingTime}`,
      });
    }

    updates.shopId = shopId;
    updates.reservationDate = bookingDate;
    updates.startTime = startTime;

    const filter = {
      _id: req.params.id,
    };
    if (req.user.role !== "admin") {
      filter.userId = req.user.id;
    }

    // Enforce owner or admin access when writing; keep ownership and status unchanged.
    const updatedReservation = await Reservation.findOneAndUpdate(
      filter,
      { $set: updates },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );
    if (!updatedReservation) {
      return res.status(404).json({
        success: false,
        error: "Reservation not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: updatedReservation,
    });
  } catch (err) {
    if (err.name === "ValidationError" || err.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "Unable to update reservation",
    });
  }
};

// @desc    Delete my reservation, or any reservation as admin
// @route   DELETE /api/v1/reservations/:id
// @access  Reservation owner or admin
exports.deleteReservation = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid reservation ID",
      });
    }
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: "Reservation not found",
      });
    }
    if (
      reservation.userId.toString() !== req.user.id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete this reservation",
      });
    }
    const filter = {
      _id: req.params.id,
    };
    if (req.user.role !== "admin") {
      filter.userId = req.user.id;
    }

    const deletedReservation = await Reservation.findOneAndDelete(filter);

    if (!deletedReservation) {
      return res.status(404).json({
        success: false,
        error: "Reservation not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: deletedReservation,
    });
  } catch (err) {
    if (err.name === "ValidationError" || err.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "Unable to delete reservation",
    });
  }
};
