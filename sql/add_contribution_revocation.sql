INSERT OR ROLLBACK INTO revocations
(
	revocation_timestamp,
	revocation_transaction,
	commitment_id
)
VALUES
(
	:revocation_timestamp,
	:revocation_transaction,
	:commitment_id
)
