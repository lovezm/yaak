-- Remove legacy default User-Agent values that were previously auto-added to
-- workspace headers, so the new runtime default browser UA can take effect.
UPDATE workspaces
SET headers = (
    SELECT COALESCE(json_group_array(json(value)), json('[]'))
    FROM json_each(headers)
    WHERE NOT (
        LOWER(json_extract(value, '$.name')) = 'user-agent'
        AND json_extract(value, '$.value') = 'yaak'
    )
)
WHERE json_array_length(headers) > 0
  AND EXISTS (
      SELECT 1
      FROM json_each(workspaces.headers)
      WHERE LOWER(json_extract(value, '$.name')) = 'user-agent'
        AND json_extract(value, '$.value') = 'yaak'
  );
