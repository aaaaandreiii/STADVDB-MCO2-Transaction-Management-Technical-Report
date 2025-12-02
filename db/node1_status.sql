CREATE TABLE IF NOT EXISTS node_status (
  node_id INT PRIMARY KEY,
  online_status TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO node_status (node_id, online_status)
VALUES (1,1),(2,1),(3,1)
ON DUPLICATE KEY UPDATE online_status = VALUES(online_status);
