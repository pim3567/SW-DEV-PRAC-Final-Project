const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { sendEmail } = require("../utils/sendEmail");

const OTP_EXPIRE = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN = 60 * 1000; // 1 minute
const MAX_OTP_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRE = 5 * 60 * 1000; // 5 minutes

// @desc   Request password reset OTP
// @route POST /api/v1/auth/forgot-password
// @access Public
exports.forgotPassword = async (req, res) => {
  try {
    const email = req.body?.email;
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email",
      });
    }

    if (!process.env.OTP_SECRET) {
      throw new Error("OTP_SECRET is not configured");
    }

    const response = {
      success: true,
      message: "If this email is registered, a reset code will be sent.",
    };

    const user = await User.findOne({
      email: email.trim(),
    });

    if (!user) {
      return res.status(200).json(response);
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    const otpHash = crypto
      .createHmac("sha256", process.env.OTP_SECRET)
      .update(otp)
      .digest("hex");

    const now = new Date();

    // Atomically enforce the cooldown, including simultaneous requests.
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        $or: [
          { resetOtpSentAt: { $exists: false } },
          { resetOtpSentAt: null },
          {
            resetOtpSentAt: {
              $lte: new Date(now.getTime() - RESEND_COOLDOWN),
            },
          },
        ],
      },
      {
        $set: {
          resetOtpHash: otpHash,
          resetOtpExpire: new Date(now.getTime() + OTP_EXPIRE),
          resetOtpSentAt: now,
          resetOtpAttempts: 0,
        },
        $unset: {
          resetPasswordToken: "",
          resetPasswordExpire: "",
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!updatedUser) {
      return res.status(200).json(response);
    }
    sendEmail({
      to: user.email,
      subject: "Massage Reservation - Password Reset OTP",
      text: [
        `Your password reset code is: ${otp}`,
        "",
        `This code expires in ${OTP_EXPIRE / (60 * 1000)} minutes.`,
        "If you did not request this, ignore this email.",
      ].join("\n"),
    }).catch((err) => {
      console.error("Reset OTP email delivery failed:", err.code || "UNKNOWN");
    });
    return res.status(200).json(response);
  } catch (err) {
    console.error("Password reset request failed:", err.code || err.name);
    return res.status(500).json({
      success: false,
      message: "Unable to process password reset request.",
    });
  }
};

// @desc   Verify a reset OTP and issue a single-use password-reset token
// @route  POST /api/v1/auth/verify-otp
// @access Public
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (
      typeof email !== "string" || !email.trim() ||
      typeof otp !== "string" || !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email and a six-digit OTP",
      });
    }
    if (!process.env.OTP_SECRET) {
      throw new Error("OTP_SECRET is not configured");
    }

    // Match the HMAC format used by forgotPassword.
    const otpHash = crypto
      .createHmac("sha256", process.env.OTP_SECRET)
      .update(otp)
      .digest("hex");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Atomically consume a correct, unexpired OTP before returning its reset token.
    const user = await User.findOneAndUpdate(
      {
        email: email.trim(),
        resetOtpHash: otpHash,
        resetOtpExpire: { $gt: new Date() },
        resetOtpAttempts: { $lt: MAX_OTP_ATTEMPTS },
      },
      {
        $set: {
          resetPasswordToken: tokenHash,
          resetPasswordExpire: new Date(Date.now() + RESET_TOKEN_EXPIRE),
          resetOtpAttempts: 0,
        },
        $unset: {
          resetOtpHash: "",
          resetOtpExpire: "",
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!user) {
      // Count only incorrect guesses for an active OTP, without exceeding the limit.
      await User.findOneAndUpdate(
        {
          email: email.trim(),
          resetOtpHash: { $exists: true, $ne: otpHash },
          resetOtpExpire: { $gt: new Date() },
          resetOtpAttempts: { $lt: MAX_OTP_ATTEMPTS },
        },
        { $inc: { resetOtpAttempts: 1 } },
        { returnDocument: "after" },
      );
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    return res.status(200).json({
      success: true,
      resetToken,
    });
  } catch (err) {
    console.error("OTP verification failed:", err.code || err.name);
    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP",
    });
  }
};

// @desc   Set a new password using a verified, single-use reset token
// @route  POST /api/v1/auth/reset-password
// @access Public
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, password, confirmPassword } = req.body || {};
    if (
      typeof resetToken !== "string" || !/^[a-f0-9]{64}$/.test(resetToken) ||
      typeof password !== "string" || typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid reset token, password, and confirmation",
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }
    if (password.length < 6 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters and at most 72 UTF-8 bytes",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    // Query updates do not run the User model's pre-save password hook.
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      {
        resetPasswordToken: tokenHash,
        resetPasswordExpire: { $gt: new Date() },
      },
      {
        $set: {
          password: passwordHash,
          resetOtpAttempts: 0,
        },
        $inc: { tokenVersion: 1 },
        $unset: {
          resetPasswordToken: "",
          resetPasswordExpire: "",
          resetOtpHash: "",
          resetOtpExpire: "",
          resetOtpSentAt: "",
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in again.",
    });
  } catch (err) {
    if (err.name === "ValidationError" || err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid password reset data",
      });
    }
    console.error("Password reset failed:", err.code || err.name);
    return res.status(500).json({
      success: false,
      message: "Unable to reset password",
    });
  }
};
