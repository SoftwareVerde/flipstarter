SELECT *
FROM campaigns
LEFT JOIN fullfillments USING (campaign_id)
WHERE campaign_id = :campaign_id
