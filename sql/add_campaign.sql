INSERT OR ROLLBACK INTO campaigns
(
    title,
	starts,
	track_name,
	track_url,
	expires
)
VALUES
(
    :title,
	:starts,
	:track_name,
	:track_url,
	:expires
)
