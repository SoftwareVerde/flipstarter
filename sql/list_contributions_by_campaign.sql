SELECT *
FROM campaigns
LEFT JOIN contributions USING (campaign_id)
LEFT JOIN users USING (user_id)
LEFT JOIN contributionCommitments USING (contribution_id)
LEFT JOIN commitments USING (commitment_id)
LEFT JOIN revocations USING (commitment_id)
WHERE campaign_id = :campaign_id
