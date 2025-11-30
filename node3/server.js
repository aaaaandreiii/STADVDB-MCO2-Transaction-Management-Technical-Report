
require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');

const transactions = require('./transactions');

app.use(express.json());
app.use('/api', transactions);

app.use('/', express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`${process.env.NODE_ID} running on port ${PORT}`);
});
