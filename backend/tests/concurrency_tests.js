'use strict';

// Automated concurrency experiments for STADVDB MCO2
//    Case #1: read–read on same row
//    Case #2: write + read on same row
//    Case #3: write–write on same row (with overlapping updates)

//    Under each isolation level:
//      READ UNCOMMITTED
//      READ COMMITTED
//      REPEATABLE READ
//      SERIALIZABLE

// Logs all results into backend/logs/concurrency_*.log

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.MCO2_BASE_URL || 'http://localhost:3000';
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(
  LOG_DIR,
  `concurrency_${new Date().toISOString().replace(/[:.]/g, '-')}.log`
);

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(message, payload) {
  const ts = new Date().toISOString();
  let line = `[${ts}] ${message}`;
  if (payload !== undefined) {
    line += ' ' + JSON.stringify(payload);
  }
  console.log(line);
  logStream.write(line + '\n');
}

async function apiPost(path, body) {
  const url = `${BASE_URL}${path}`;
  const res = await axios.post(url, body);
  const data = res.data;
  if (!data || data.ok !== true) {
    throw new Error((data && data.error) || `Request to ${path} failed`);
  }
  return data;
}

async function startTx(nodeId, isolationLevel, description) {
  const data = await apiPost('/api/tx/start', {
    nodeId,
    isolationLevel,
    description
  });
  return data.tx;
}

async function readTrans(txId, transId) {
  const data = await apiPost('/api/tx/read', { txId, transId });
  return data.result;
}

async function updateTrans(txId, transId, amountDelta, balanceDelta) {
  const data = await apiPost('/api/tx/update', {
    txId,
    transId,
    amountDelta,
    balanceDelta
  });
  return data.result;
}

async function commitTx(txId) {
  const data = await apiPost('/api/tx/commit', { txId });
  return data.result;
}

async function rollbackTx(txId) {
  try {
    const data = await apiPost('/api/tx/rollback', { txId });
    return data.result;
  } catch (err) {
    log(`ROLLBACK error for ${txId}`, { error: err.message });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ISOLATION_LEVELS = [
  'READ UNCOMMITTED',
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE'
];


const TEST_NODE_ID = 1;  // central node
const TEST_TRANS_ID = 1; // (arbitrary) Credit row


//Case #1: concurrent reads of the same data item
//    Both Tx A and Tx B read the same row

async function case1_readRead(isolationLevel, runNo) {
  log('=== Case #1: read-read ===', {
    isolationLevel,
    runNo
  });

  let txA, txB;
  try {
    txA = await startTx(TEST_NODE_ID, isolationLevel, 'Case1 TxA reader');
    txB = await startTx(TEST_NODE_ID, isolationLevel, 'Case1 TxB reader');

    const [resA, resB] = await Promise.all([
      readTrans(txA.txId, TEST_TRANS_ID),
      readTrans(txB.txId, TEST_TRANS_ID)
    ]);

    log('Case1 TxA read', resA.row);
    log('Case1 TxB read', resB.row);
  } catch (err) {
    log('Case1 ERROR', { error: err.message });
  } finally {
    if (txA) await rollbackTx(txA.txId);
    if (txB) await rollbackTx(txB.txId);
  }
}

//Case #2: write + read on the same data item
//    1. Tx A reads row
//    2. Tx A updates row (uncommitted)
//    3. Tx B reads row before Tx A commits (dirty read possible)
//    4. Tx A commits
//    5. Tx B reads again in the same transaction (non-repeatable read possible)

async function case2_writeRead(isolationLevel, runNo) {
  log('=== Case #2: write + read ===', {
    isolationLevel,
    runNo
  });

  let txA, txB;
  try {
    txA = await startTx(TEST_NODE_ID, isolationLevel, 'Case2 writer TxA');
    txB = await startTx(TEST_NODE_ID, isolationLevel, 'Case2 reader TxB');

    const readA1 = await readTrans(txA.txId, TEST_TRANS_ID);
    log('Case2 TxA initial read', readA1.row);

    const updA = await updateTrans(txA.txId, TEST_TRANS_ID, 10, 10);
    log('Case2 TxA UPDATE (uncommitted)', updA.op);

    const readB1 = await readTrans(txB.txId, TEST_TRANS_ID);
    log('Case2 TxB read before A commit', readB1.row);

    const commitA = await commitTx(txA.txId);
    log('Case2 TxA COMMIT', commitA);

    const readB2 = await readTrans(txB.txId, TEST_TRANS_ID);
    log('Case2 TxB second read after A commit (same TxB)', readB2.row);

    const commitB = await commitTx(txB.txId);
    log('Case2 TxB COMMIT', commitB);
  } catch (err) {
    log('Case2 ERROR', { error: err.message });
    if (txA) await rollbackTx(txA.txId);
    if (txB) await rollbackTx(txB.txId);
  }
}

//Case #3: concurrent writes on the same data item
//    1. Tx A and Tx B start on the same row
//    2. Tx A updates and holds the lock (no commit yet)
//    3. Tx B attempts update 
//          will block on the row lock
//    4. While B is blocked, commit A
//    5. Tx B's update then proceeds
//    6. Commit B and inspect the final value in a new transaction

async function case3_writeWrite(isolationLevel, runNo) {
  log('=== Case #3: write-write ===', {
    isolationLevel,
    runNo
  });

  let txA, txB;
  try {
    txA = await startTx(TEST_NODE_ID, isolationLevel, 'Case3 writer TxA');
    txB = await startTx(TEST_NODE_ID, isolationLevel, 'Case3 writer TxB');

    const readA = await readTrans(txA.txId, TEST_TRANS_ID);
    const readB = await readTrans(txB.txId, TEST_TRANS_ID);
    log('Case3 TxA initial read', readA.row);
    log('Case3 TxB initial read', readB.row);

    const updA = await updateTrans(txA.txId, TEST_TRANS_ID, 10, 10);
    log('Case3 TxA UPDATE (uncommitted)', updA.op);

    const updBPromise = updateTrans(txB.txId, TEST_TRANS_ID, 20, 20);
    log('Case3 TxB UPDATE sent (may block on lock)...');

    await sleep(200);

    const commitA = await commitTx(txA.txId);
    log('Case3 TxA COMMIT', commitA);

    const updB = await updBPromise;
    log('Case3 TxB UPDATE completed after A commit', updB.op);

    const commitB = await commitTx(txB.txId);
    log('Case3 TxB COMMIT', commitB);

    const txCheck = await startTx(TEST_NODE_ID, isolationLevel, 'Case3 final check');
    const finalRead = await readTrans(txCheck.txId, TEST_TRANS_ID);
    log('Case3 final value after both commits', finalRead.row);
    await commitTx(txCheck.txId);
  } catch (err) {
    log('Case3 ERROR', { error: err.message });
    if (txA) await rollbackTx(txA.txId);
    if (txB) await rollbackTx(txB.txId);
  }
}

async function main() {
  log('--- Starting concurrency tests ---', { BASE_URL });

  //3 runs per case per isolation level
  for (const iso of ISOLATION_LEVELS) {
    for (let run = 1; run <= 3; run++) {
      await case1_readRead(iso, run);
      await case2_writeRead(iso, run);
      await case3_writeWrite(iso, run);
    }
  }

  log('--- Concurrency tests completed ---');
  logStream.end();
}

main().catch((err) => {
  log('FATAL ERROR in concurrency tests', { error: err.message });
  logStream.end();
  process.exit(1);
});
