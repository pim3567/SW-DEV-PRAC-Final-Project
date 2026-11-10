const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();

app.set('query parser', 'extended');

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

//mount routers
const auth = require('./routes/auth');
const shops = require('./routes/shops');
const reservations = require('./routes/reservations');
const closingDates = require('./routes/closingDates');

app.use('/api/v1/auth', auth);
app.use('/api/v1/shops', shops);
app.use('/api/v1/reservations', reservations);
app.use('/api/v1/closing-dates', closingDates);

module.exports = app;
