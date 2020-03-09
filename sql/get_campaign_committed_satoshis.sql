SELECT SUM(satoshis) AS committed_satoshis
FROM commitments
LEFT JOIN contributionCommitments USING (commitment_id)
LEFT JOIN contributions USING (contribution_id)
LEFT JOIN revocations USING (commitment_id)
WHERE
	revocation_id IS NULL AND
	campaign_id = :campaign_id
