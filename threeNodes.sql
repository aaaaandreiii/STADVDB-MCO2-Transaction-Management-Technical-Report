-- node 1
CREATE DATABASE IF NOT EXISTS `mydb_node1`;
USE `mydb_node1`;

DROP TABLE IF EXISTS `node1_trans`;
CREATE TABLE `node1_trans` (
  `trans_id` int NOT NULL,
  `account_id` int DEFAULT NULL,
  `newdate` date DEFAULT NULL,
  `type` varchar(20),
  `amount` double DEFAULT NULL,
  PRIMARY KEY (`trans_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO node1_trans (trans_id, account_id, newdate, type, amount)
SELECT trans_id, account_id, newdate, type, amount
FROM mydb.trans
LIMIT 20000;

-- Check counts
-- SELECT COUNT(*) AS node1_count FROM mydb_node1.node1_trans; -- 20000
-- SELECT COUNT(*) AS node1_count FROM mydb_node1.node1_trans WHERE type = 'Credit'; -- 4745
-- SELECT COUNT(*) AS node1_count FROM mydb_node1.node1_trans WHERE type LIKE 'Debit%'; -- 14892
-- SELECT COUNT(*) AS node1_count FROM mydb_node1.node1_trans WHERE type = 'Vyber'; -- 363
SELECT type, COUNT(*) AS total_count
FROM node1_trans
GROUP BY type;

-- node 2
CREATE DATABASE IF NOT EXISTS `mydb_node2`;
USE `mydb_node2`;

DROP TABLE IF EXISTS `node2_trans`;
CREATE TABLE `node2_trans` (
  `trans_id` int NOT NULL,
  `account_id` int DEFAULT NULL,
  `newdate` date DEFAULT NULL,
  `type` varchar(20),
  `amount` double DEFAULT NULL,
  PRIMARY KEY (`trans_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO node2_trans (trans_id, account_id, newdate, type, amount)
SELECT trans_id, account_id, newdate, type, amount
FROM mydb_node1.node1_trans
WHERE type = 'Credit';

-- Verify counts
-- SELECT COUNT(*) AS node2_count FROM node2_trans; -- should be 4745
SELECT type, COUNT(*) AS total_count
FROM node2_trans
GROUP BY type;

-- node 3
CREATE DATABASE IF NOT EXISTS `mydb_node3`;
USE `mydb_node3`;

DROP TABLE IF EXISTS `node3_trans`;
CREATE TABLE `node3_trans` (
  `trans_id` int NOT NULL,
  `account_id` int DEFAULT NULL,
  `newdate` date DEFAULT NULL,
  `type` varchar(20),
  `amount` double DEFAULT NULL,
  PRIMARY KEY (`trans_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO node3_trans (trans_id, account_id, newdate, type, amount)
SELECT trans_id, account_id, newdate, type, amount
FROM mydb_node1.node1_trans
WHERE type LIKE 'Debit%' OR type = 'Vyber';

-- Verify counts
-- SELECT COUNT(*) AS node3_count FROM node3_trans; -- should be 14892 + 363 = 15255
SELECT type, COUNT(*) AS total_count
FROM node3_trans
GROUP BY type;
