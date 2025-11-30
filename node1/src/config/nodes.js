const dotenv = require('dotenv');

dotenv.config();

// helper to parse integer env vars
function envInt(name, defaultValue) {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

const nodes = {
  1: {
    id: 1,
    role: 'central',
    db: {
      host: process.env.DB_HOST_NODE1 || '127.0.0.1',
      port: envInt('DB_PORT_NODE1', 3306),
      user: process.env.DB_USER_NODE1 || 'root',
      password: process.env.DB_PASS_NODE1 || '',
      database: process.env.DB_NAME_NODE1 || 'mydb_node1'
    }
  },
  2: {
    id: 2,
    role: 'fragment',
    fragment: 'accounts_1_2',
    db: {
      host: process.env.DB_HOST_NODE2 || '127.0.0.1',
      port: envInt('DB_PORT_NODE2', 3306),
      user: process.env.DB_USER_NODE2 || 'root',
      password: process.env.DB_PASS_NODE2 || '',
      database: process.env.DB_NAME_NODE2 || 'mydb_node2'
    }
  },
  3: {
    id: 3,
    role: 'fragment',
    fragment: 'accounts_3_4',
    db: {
      host: process.env.DB_HOST_NODE3 || '127.0.0.1',
      port: envInt('DB_PORT_NODE3', 3306),
      user: process.env.DB_USER_NODE3 || 'root',
      password: process.env.DB_PASS_NODE3 || '',
      database: process.env.DB_NAME_NODE3 || 'mydb_node3'
    }
  }
};

const currentNodeId = parseInt(process.env.NODE_ID || '1', 10);

if (![1, 2, 3].includes(currentNodeId)) {
  throw new Error('NODE_ID must be 1, 2, or 3 in your .env file');
}

const currentNode = nodes[currentNodeId];

module.exports = {
  nodes,
  currentNodeId,
  currentNode
};
