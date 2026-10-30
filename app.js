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

app.use('/api/v1/auth', auth);

module.exports = app;
