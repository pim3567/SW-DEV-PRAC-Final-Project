# SW-DEV-PRAC-Final-Project

A REST API for booking massage appointments. Customers can browse massage shops and manage their reservations, while admins manage shops and reservations across all customers. The project provides a backend API tested through Bruno or Postman; a frontend is not included.

## Features

- Register, log in, and retrieve the current user's profile using JWT authentication.
- Browse massage shops with their name, address, telephone number, and opening hours.
- Create up to three active reservations per customer. Pending and confirmed reservations count toward the limit.
- View, edit, and delete your own reservations.
- Allow admins to view, edit, and delete any reservation, and create or edit shops.
- Reset passwords using an emailed OTP and a single-use reset token. Successful resets invalidate existing login tokens.
- Notify all admin accounts by email after a customer successfully creates a reservation.

Public registration creates a normal user account. Admin permissions must be assigned separately through a trusted process.

## Technology

| Area | Tools |
|---|---|
| API | Node.js, Express |
| Database | MongoDB, Mongoose |
| Authentication | JSON Web Tokens, bcryptjs |
| Email | Nodemailer with SMTP |
| Request handling | JSON and multipart text fields through Multer |
| Testing | Jest, Supertest, Bruno |

## Getting started

1. Install dependencies with `npm install`.
2. Follow the [SMTP and environment setup guide](docs/STMPsetting.md) to configure MongoDB, JWT secrets, and email credentials.
3. Start the API with `npm run dev`.
4. Open `bruno/MassageReservation` in Bruno and use `http://localhost:5000` as `URL`, unless you changed the port.

Run commands from the project root. Reservation creation requires MongoDB transactions, so use Atlas or another replica set rather than a standalone database.

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
| DELETE | `/reservations/:id` | Owner or admin |

## Project structure

| Path | Purpose |
|---|---|
| `server.js` | Loads configuration, connects MongoDB, and starts the server |
| `app.js` | Configures Express middleware and API routes |
| `controllers/` | Authentication, password reset, shop, and reservation logic |
| `models/` | Mongoose schemas |
| `routes/` | Endpoint definitions and request parsing |
| `middleware/` | Authentication and role checks |
| `utils/` | Shared SMTP email utility |
| `config/config.env.example` | Environment template with placeholders |
| `bruno/MassageReservation/` | Bruno requests and variables |
| `__tests__/` | Automated API and controller tests |
| `docs/` | Environment setup and backend documentation |

## Testing

```powershell
npm test
```

Automated tests use mocked database and email operations. For a manual check, configure your own database and SMTP credentials, log in through Bruno, and run the shop, reservation, or password-reset requests.

Bruno requests use the most recent successful login's `token` variable. Replace placeholder IDs and select future booking dates before sending requests. Creating a customer reservation also attempts the admin notification email; email delivery failures are logged without undoing the booking, and automatic delivery retries are not implemented.

## Documentation

- [SMTP and environment settings](docs/STMPsetting.md)
- [Backend documentation](docs/readme.md)

Keep real passwords, connection strings, and secrets in `config/config.env`, which is ignored by Git. Share the example configuration with placeholders.
