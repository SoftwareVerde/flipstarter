INSERT OR ROLLBACK INTO commitments
(
	previous_transaction_hash,
	previous_transaction_index,
	unlock_script,
	sequence_number,
	satoshis
)
VALUES
(
	:previous_transaction_hash,
	:previous_transaction_index,
	:unlock_script,
	:sequence_number,
	:satoshis
)
