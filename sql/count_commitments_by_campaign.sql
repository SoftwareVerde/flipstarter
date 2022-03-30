SELECT COUNT(DISTINCT commitment_id) AS commitment_count
FROM campaigns
LEFT JOIN contributions USING (campaign_id)
LEFT JOIN contribution_commitments USING (contribution_id)
LEFT JOIN commitments USING (commitment_id)
LEFT JOIN revocations USING (commitment_id)
WHERE campaign_id = :campaign_id
AND revocation_id IS NULL
