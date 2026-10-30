# SW-DEV-PRAC Final Project – Backend Docs

Express + MongoDB (Mongoose) backend with JWT authentication.

## Setup

1. Install dependencies: `npm install`
2. Create `config/config.env`:

   ```
   PORT=5000
   NODE_ENV=development
   MONGO_URI=<your mongodb connection string>
   JWT_SECRET=<secret>
   JWT_EXPIRE=30d
   JWT_COOKIE_EXPIRE=30
   ```
3. Run: `npm run dev` (nodemon) or `node server.js`

## Project structure

| Path | Purpose |
|------|---------|
| `app.js` | Express app (middleware + routes), imported by tests |
| `server.js` | Loads env, connects DB, starts the server |
| `models/User.js` | User schema (name, tel, email, role, password) |
| `controllers/auth.js` | register, login, logout, getMe |
| `middleware/auth.js` | `protect` (JWT check) and `authorize` (role check) |
| `routes/auth.js` | Auth routes |
| `__tests__/` | Jest tests |
| `bruno/` | Bruno API collection |

## User model

| Field | Type | Notes |
|-------|------|-------|
| name | String | required |
| tel | String | required |
| email | String | required, unique, valid email |
| role | String | `user` (default) or `admin` |
| password | String | required, min 6, hashed with bcrypt, not returned by default |
| createdAt | Date | default now |

## API – `/api/v1/auth`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/register` | Public | Create a user and return a token |
| POST | `/login` | Public | Log in and return a token |
| GET | `/logout` | Private | Clear the token cookie |
| GET | `/me` | Private | Get the current user |

Private routes need the header `Authorization: Bearer <token>`.

### POST /register

Request:

```json
{ "name": "Admin02", "tel": "0812345678", "email": "admin02@gmail.com", "password": "12345678", "role": "admin" }
```

Response `200`:

```json
{ "success": true, "_id": "...", "name": "Admin02", "tel": "0812345678", "email": "admin02@gmail.com", "role": "admin", "token": "..." }
```

Errors: `400` `{ "success": false, "message": "..." }` (e.g. missing `tel`, duplicate email).

### POST /login

Request: `{ "email": "...", "password": "..." }`
Response `200`: same shape as register, and sets an HTTP-only `token` cookie.
Errors: `400` missing email/password; `401` invalid credentials.

### GET /logout

Response `200`: `{ "success": true, "data": {} }`. Errors: `401` if not authorized.

### GET /me

Response `200`: `{ "success": true, "data": { ...user } }`. Errors: `401` if not authorized.

## Testing

### Jest (`__tests__/`)

- `auth.test.js` – register (with `tel`), login and logout using supertest; the User model is mocked, so no database is needed.

Run: `npm test`

### Bruno (`bruno/MassageReservation/auth`)

Open `bruno/MassageReservation` as a collection in Bruno (base `URL` is `http://localhost:5000`). Requests are split by role:

- `admin/` – registers/logs in `admin02@gmail.com` with role `admin`; token stored in `adminToken`.
- `user/` – registers/logs in `user01@gmail.com` with role `user`; token stored in `userToken`.

In each folder run in order: `register` → `login` → `getme` → `logout`.
