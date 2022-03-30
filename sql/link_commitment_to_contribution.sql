INSERT OR ROLLBACK INTO contribution_commitments
(
	commitment_id,
	contribution_id
)
VALUES
(
	:commitment_id,
	:contribution_id
)
