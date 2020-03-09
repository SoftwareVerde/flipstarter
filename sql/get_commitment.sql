SELECT *
FROM commitments
LEFT JOIN revocations USING (commitment_id)
WHERE commitment_id = :commitment_id
