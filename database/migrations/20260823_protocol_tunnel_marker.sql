-- Protocol tunnel ownership upgrade.
-- Run against an existing TMS database before deploying the marker-aware backend.
-- The duplicate-name query must return no rows before the unique index is added.

SET @has_protocol_managed_column := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tunnel'
      AND column_name = 'protocol_managed'
);
SET @sql := IF(
    @has_protocol_managed_column = 0,
    'ALTER TABLE tunnel ADD COLUMN protocol_managed TINYINT(1) NOT NULL DEFAULT 0 AFTER name',
    'SELECT 1'
);
PREPARE protocol_tunnel_schema_stmt FROM @sql;
EXECUTE protocol_tunnel_schema_stmt;
DEALLOCATE PREPARE protocol_tunnel_schema_stmt;

-- Backfill only rows that have both the canonical generated name and at least
-- one generated protocol forward. Ordinary manual tunnels remain 0.
UPDATE tunnel t
SET t.protocol_managed = 1
WHERE CONVERT(t.name USING utf8mb4) COLLATE utf8mb4_bin = CONCAT('inbound-tunnel-node', t.in_node_id)
  AND t.type = 1
  AND EXISTS (
      SELECT 1
      FROM forward f
      INNER JOIN inbound_user iu ON iu.gost_forward_id = f.id
      INNER JOIN inbound i ON i.id = iu.inbound_id
      WHERE f.tunnel_id = t.id
        AND i.node_id = t.in_node_id
        AND CONVERT(f.name USING utf8mb4) COLLATE utf8mb4_bin =
            CONCAT('inbound-', i.id, '-user-', iu.user_id)
  );

-- Audit before enforcing uniqueness. Resolve any returned rows manually.
SELECT name, COUNT(*) AS duplicate_count
FROM tunnel
GROUP BY name
HAVING COUNT(*) > 1;

SET @has_tunnel_name_index := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'tunnel'
      AND index_name = 'uk_tunnel_name'
);
SET @sql := IF(
    @has_tunnel_name_index = 0,
    'ALTER TABLE tunnel ADD UNIQUE KEY uk_tunnel_name (name)',
    'SELECT 1'
);
PREPARE protocol_tunnel_index_stmt FROM @sql;
EXECUTE protocol_tunnel_index_stmt;
DEALLOCATE PREPARE protocol_tunnel_index_stmt;
