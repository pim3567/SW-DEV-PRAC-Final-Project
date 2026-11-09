# SMTP and environment settings

Express REST API for massage shops and reservations, using MongoDB and JWT authentication.

## Environment setup

Run commands from the project root. Install dependencies, then copy the environment template:

```powershell
npm install
Copy-Item config/config.env.example config/config.env
```

If `config/config.env` already exists, edit it instead of copying over your settings.
The server loads this file using `dotenv` in `server.js`.

Replace the placeholders in `config/config.env`:

```dotenv
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://DB_USER:DB_PASSWORD@YOUR_CLUSTER.mongodb.net/massage_reservation?retryWrites=true&w=majority
JWT_SECRET=REPLACE_WITH_RANDOM_SECRET
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourname@gmail.com
SMTP_PASSWORD=REPLACE_WITH_GOOGLE_APP_PASSWORD
EMAIL_FROM=yourname@gmail.com

# Password-reset OTP secret:
OTP_SECRET=REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET
```

| Variable | Purpose |
|---|---|
| `PORT` | API port; Bruno's `URL` must use the same port. |
| `NODE_ENV` | Use `development` locally. Production enables secure login cookies. |
| `MONGO_URI` | MongoDB connection string. Use Atlas or another replica set for reservation transactions. |
| `JWT_SECRET` | Private signing key for login tokens. Changing it invalidates existing tokens. |
| `JWT_EXPIRE` | Login token lifetime, such as `30d`. |
| `JWT_COOKIE_EXPIRE` | Login cookie lifetime in days, such as `30`. |
| `SMTP_HOST` | Your provider's outgoing email server. |
| `SMTP_PORT` | `587` for STARTTLS, or `465` for immediate TLS. |
| `SMTP_USER` | SMTP username; for Gmail, your full email address. |
| `SMTP_PASSWORD` | Provider-issued SMTP credential; for Gmail, an App Password. |
| `EMAIL_FROM` | Sender address authorized by the email provider. |
| `OTP_SECRET` | Secret used to protect password-reset OTPs. Reset endpoints accept multipart fields or JSON. |

Booking notifications are sent to the email addresses of all users whose database role is `admin`.
`ADMIN_NOTIFICATION_EMAIL` is no longer used and can be removed from local configuration.
Sender authentication still uses the SMTP settings above. Lookup and delivery failures are logged without undoing a booking; automatic retries are not implemented.

### MongoDB Atlas

1. Create a cluster and a database user.
2. Add your current public IP address to the project's IP access list.
3. Choose **Connect > Drivers > Node.js** and copy the connection string.
4. Replace its username and password placeholders and add `massage_reservation` as the database name.
5. URL-encode special characters in the database password, for example `@` becomes `%40`.

The connection string must start with `mongodb://` or `mongodb+srv://`.
Reservation creation uses transactions, which require a replica set or sharded deployment; a standalone local MongoDB server is insufficient.

### Generate secrets

Run this command separately for `JWT_SECRET` and `OTP_SECRET`, using a different output for each:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Gmail SMTP

1. Enable **2-Step Verification** on the sender's Google account.
2. Open [Google App Passwords](https://myaccount.google.com/apppasswords).
3. Create an App Password named `MassageReservation`.
4. Set `SMTP_USER` and `EMAIL_FROM` to that account's email address.
5. Put the generated App Password, without spaces, in `SMTP_PASSWORD`.

Use an App Password instead of your normal Gmail password. Some school or work accounts restrict this feature.
See [Google's App Password guide](https://support.google.com/accounts/answer/185833).

Check the SMTP connection without sending an email:

```powershell
node -e "require('dotenv').config({path:'config/config.env'}); require('./utils/sendEmail').verifyEmailConnection().then(() => console.log('SMTP connection works')).catch(console.error)"
```

This checks connection and authentication; it does not confirm inbox delivery.

### Start the API

```powershell
npm run dev
```

Look for `MongoDB Connected` in the terminal. Restart the server after changing environment settings.
In Bruno, use `http://localhost:5000` for `URL` unless you changed `PORT`.

`config/config.env` is ignored by Git. Commit the example file with placeholders, and keep real passwords, connection strings, and secrets private.

See [the backend documentation](readme.md) for additional API details.
