SELECT *
FROM recipients
LEFT JOIN users USING (user_id)
WHERE campaign_id = :campaign_id
