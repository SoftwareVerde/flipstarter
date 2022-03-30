SELECT *
FROM contributions
LEFT JOIN users USING (user_id)
LEFT JOIN contribution_commitments USING (contribution_id)
LEFT JOIN commitments USING (commitment_id)
LEFT JOIN revocations USING (commitment_id)
WHERE user_id = :user_id
