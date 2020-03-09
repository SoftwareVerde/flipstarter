SELECT SUM(recipient_satoshis) AS requested_satoshis
FROM recipients
WHERE campaign_id = :campaign_id
