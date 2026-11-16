# SW-DEV-PRAC-Final-Project

A REST API for booking massage appointments. Customers can browse massage shops and manage their reservations, while admins manage shops and reservations across all customers. The project provides a backend API tested through Bruno or Postman; a frontend is not included.

## Features

- Register, log in, and retrieve the current user's profile using JWT authentication.
- Browse massage shops with their name, address, telephone number, and opening hours.
- Create up to three confirmed reservations per customer. Completed and cancelled reservations do not count toward the limit.
- View, edit, and delete your own reservations.
- Allow admins to view, edit, and delete any reservation, and create or edit shops.
- Reset passwords using an emailed OTP and a single-use reset token. Successful resets invalidate existing login tokens.
- Notify all admin accounts by email after a customer successfully creates a reservation.
- Submit one rating from 1 to 5 stars for each completed reservation you own, and view ratings filtered by shop.
- Send newly registered users a welcome email with a unique promo code for 10% off, valid for 30 days.
- Allow admins to create, view, edit, and delete special closing dates. Reservations cannot be created or moved onto those dates.

Registration defaults to the `user` role when `role` is omitted. **Known security issue:** the current registration controller also accepts a client-supplied `role`, including `admin`. Public registration does not enforce user-only access yet. Restrict registration before exposing this API publicly; admin permissions should be assigned through a trusted process.

## Reservation lifecycle

New bookings start as `confirmed`. The reservation owner or an admin can explicitly mark a confirmed booking `completed` or `cancelled`. Completion is allowed regardless of the scheduled date and time.

Completed and cancelled bookings cannot change status or be rescheduled. Cancellation retains the booking history; the DELETE endpoint permanently removes a record.

Use `PATCH /api/v1/reservations/:id/status` with `status` set to `completed` or `cancelled`. The Bruno collection includes separate completion and cancellation requests. Log in as the reservation owner or an admin before using them.

If an existing database contains `pending` reservations, migrate those records to `confirmed` before running the new counting rule. Database migration is not automatic.

## Technology

| Area | Tools |
|---|---|
| API | Node.js, Express |
| Database | MongoDB, Mongoose |
| Authentication | JSON Web Tokens, bcryptjs |
| Email | Nodemailer with SMTP |
| Request handling | JSON and multipart text fields through Multer |
| Testing | Jest, Supertest, Bruno, Postman, Newman |

## Getting started

1. Install Node.js and npm, then install dependencies with `npm install`.
2. Follow the [SMTP and environment setup guide](docs/STMPsetting.md) to configure MongoDB, JWT secrets, and email credentials.
3. Start the API with `npm run dev`.
4. Open `bruno/MassageReservation` in Bruno, or import either JSON collection from `postman/` into Postman. Set `URL` to `http://localhost:5000`, unless you changed the port. Do not include `/api/v1` or a trailing slash in this variable.

Run commands from the project root. Reservation creation requires MongoDB transactions, so use Atlas or another replica set rather than a standalone database.

The Newman collections require an existing admin account. Set their `adminEmail` and `adminPassword` variables to that demo account's credentials. The main demo also requires an existing shop open on its generated booking date, seven days after the run date.

## API overview

All endpoints use the `/api/v1` prefix. Protected endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| GET | `/auth/me`, `/auth/logout` | Logged-in user |
| POST | `/auth/forgot-password` | Public, rate limited |
| POST | `/auth/verify-otp` | Public, rate limited |
| POST | `/auth/reset-password` | Public, rate limited |
| GET | `/shops` | Public |
| POST | `/shops` | Admin |
| PUT | `/shops/:id` | Admin |
| POST | `/reservations` | Logged-in user |
| GET | `/reservations` | Own reservations; admins see all |
| GET | `/reservations/:id` | Owner or admin |
| PUT | `/reservations/:id` | Owner or admin |
| PATCH | `/reservations/:id/status` | Owner or admin to complete or cancel |
| DELETE | `/reservations/:id` | Owner or admin |
| POST | `/reservations/:id/rating` | Reservation owner, after completion |
| GET | `/ratings` | Logged-in user or admin; optional `shopId` query filter |
| POST | `/shops/:shopId/closing-dates` | Admin |
| GET | `/shops/:shopId/closing-dates` | Admin |
| PUT | `/closing-dates/:id` | Admin |
| DELETE | `/closing-dates/:id` | Admin |

## Project structure

| Path | Purpose |
|---|---|
| `server.js` | Loads configuration, connects MongoDB, and starts the server |
| `app.js` | Configures Express middleware and API routes |
| `controllers/` | Authentication, password reset, shops, reservations, ratings, and closing date logic |
| `models/` | Mongoose schemas |
| `routes/` | Endpoint definitions and request parsing |
| `middleware/` | Authentication and role checks |
| `utils/` | Shared SMTP delivery and welcome coupon email logic |
| `config/config.env.example` | Environment template with placeholders |
| `bruno/MassageReservation/` | Bruno requests and variables |
| `postman/MassageReservation.demo.json` | Main presentation workflow and booking validation |
| `postman/MassageReservation.additional.json` | Additional requirements and optional real-email password reset workflow |
| `__tests__/` | Automated API and controller tests |
| `docs/` | Environment setup and backend documentation |

## Testing

### Jest tests

Run API and controller tests with mocked database and email operations:

```powershell
npm test
```

These tests do not verify a live database or SMTP delivery.

### Newman presentation demo

Keep the API running in one terminal, then run the main collection in another:

```powershell
npx newman run ./postman/MassageReservation.demo.json
```

The collection registers a new user, validates registration and booking conditions, creates three confirmed bookings, and verifies that a fourth is rejected. It also checks user booking CRUD and admin access to another user's bookings. Logout checks run last, with admin logout as the final request.

Override collection settings locally when needed:

```powershell
npx newman run ./postman/MassageReservation.demo.json `
  --env-var "URL=http://localhost:5000" `
  --env-var "adminEmail=your_admin_email" `
  --env-var "adminPassword=your_admin_password"
```

### Newman additional requirements

Run the additional collection against the same API:

```powershell
npx newman run ./postman/MassageReservation.additional.json
```

It checks admin shop creation and editing, ratings after completion, special closing date CRUD, access restrictions, and password-reset input validation. Its collection-level response-time assertion checks each observed request against the three-second target; it does not establish performance under load.

**A successful default run does not verify every additional requirement.** Three email assertions are marked `skipped`, and the successful OTP reset workflow is skipped until you provide a real code and account credentials. Check the admin inbox for booking notifications and customer inboxes for welcome emails and unique promo codes. To receive the first welcome email, add `--env-var "customerEmail=your_unused_demo_email"` when running this collection. The second generated user uses an `example.com` address; compare coupon records in the demo database, or repeat with another accessible customer email, to verify uniqueness.

Both collections use the normal database and email configuration. Use a demo database: the main demo leaves its newly registered user, and the additional collection leaves users, a shop, coupons, and ratings. Successful runs delete their test bookings; the additional collection also deletes its special closing date. Failed or interrupted runs may leave those records too. Logout invalidates the account's existing sessions, including other clients.

### Password reset with a real OTP

Use an existing demo user whose email inbox you can access. Request a code with the additional collection:

```powershell
npx newman run ./postman/MassageReservation.additional.json `
  --folder "02 - Request password reset OTP" `
  --env-var "resetEmail=your_registered_demo_email"
```

Read the email, then run the verification and final logout folders within five minutes. Replace the placeholders below; this changes that demo account's password:

```powershell
npx newman run ./postman/MassageReservation.additional.json `
  --folder "03 - Verify OTP and reset password" `
  --folder "04 - Final logout" `
  --env-var "resetEmail=your_registered_demo_email" `
  --env-var "resetPassword=your_current_password" `
  --env-var "resetOtp=123456" `
  --env-var "resetNewPassword=your_new_password"
```

This workflow checks incorrect and reused OTPs, password confirmation and length, a successful reset, rejection of the old password and login token, and login with the new password. Final logout requests without tokens from the current run are skipped. The reset routes share a rate limiter of ten requests per IP per fifteen minutes; repeated runs can return `429`.

Inspect the assertion failures and skipped checks in Newman's output. Zero failed HTTP requests alone does not mean the API returned the expected results. Never commit real credentials, OTPs, or exported login tokens into a collection.

### Manual requests with Bruno

Configure your database and SMTP credentials, log in through Bruno, and run the shop, reservation, rating, closing date, or password-reset requests.

Bruno requests use the most recent successful login's `token` variable. Replace placeholder IDs and select future booking dates before sending requests. Creating a customer reservation also attempts the admin notification email; email delivery failures are logged without undoing the booking, and automatic delivery retries are not implemented.

## Documentation

- [SMTP and environment settings](docs/STMPsetting.md)
- [Backend documentation](docs/readme.md)
- [Functional and non-functional requirements](docs/requirement.md)

Keep real passwords, connection strings, and secrets in `config/config.env`, which is ignored by Git. Share the example configuration with placeholders.
