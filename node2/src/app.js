const express = require('express');
const path = require('path');
const hbs = require('hbs');
const { currentNodeId, currentNode } = require('./config/nodes');

const indexRoutes = require('./routes/index');
const transactionsRoutes = require('./routes/transactions');
const concurrencyRoutes = require('./routes/concurrency');
const txApiRoutes = require('./routes/txApi');
const replicationApiRoutes = require('./routes/replication');
const adminRoutes = require('./routes/admin');
const replicationPageRoutes = require('./routes/replicationPage');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  '/public',
  express.static(path.join(__dirname, 'public'))
);

// ---- Handlebars view engine ----
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

hbs.registerHelper('nextSortDir', (currentBy, currentDir, column) => {
  if (currentBy === column && currentDir === 'asc') {
    return 'desc';
  }
  return 'asc';
});

hbs.registerHelper('sortIndicator', (currentBy, currentDir, column) => {
  if (currentBy !== column) return '';
  return currentDir === 'asc' ? '▲' : '▼';
});

hbs.registerHelper('encodeURIComponent', (str) => {
  return encodeURIComponent(str || '');
});

// locals per-request so views know where they are running
app.use((req, res, next) => {
  res.locals.nodeId = currentNodeId;
  res.locals.nodeRole = currentNode.role;
  next();
});

// routes
app.use('/', indexRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/concurrency', concurrencyRoutes);
app.use('/replication', replicationPageRoutes);
app.use('/admin', adminRoutes);

app.use('/api/tx', txApiRoutes);
app.use('/api/replication', replicationApiRoutes);

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  if (res.headersSent) return;
  res
    .status(500)
    .send('Internal Server Error: ' + (err.message || String(err)));
});

module.exports = app;