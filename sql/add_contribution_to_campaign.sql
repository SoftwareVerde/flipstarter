INSERT OR ROLLBACK INTO contributions
(
	user_id,
	campaign_id,
	contribution_comment,
	contribution_timestamp
)
VALUES
(
	:user_id,
	:campaign_id,
	:contribution_comment,
	:contribution_timestamp
)
