INSERT OR ROLLBACK INTO recipients
(
	user_id,
	campaign_id,
	recipient_satoshis
)
VALUES
(
	:user_id,
	:campaign_id,
	:recipient_satoshis
)
