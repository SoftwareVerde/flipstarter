SELECT *
FROM commitments
LEFT JOIN revocations USING (commitment_id)
WHERE
	previous_transaction_hash = :previous_transaction_hash AND
	previous_transaction_index = :previous_transaction_index
