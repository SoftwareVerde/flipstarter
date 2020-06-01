INSERT OR ROLLBACK INTO campaigns
(
    title,
	starts,
	expires
)
VALUES
(
    :title,
	:starts,
	:expires
)
