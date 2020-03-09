SELECT *
FROM recipients
LEFT JOIN campaigns USING (campaign_id)
LEFT JOIN fullfillments USING (campaign_id)
WHERE recipients.user_id = :user_id
