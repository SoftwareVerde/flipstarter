INSERT OR ROLLBACK INTO fullfillments
(
	fullfillment_timestamp,
	fullfillment_transaction,
	campaign_id
)
VALUES
(
	:fullfillment_timestamp,
	:fullfillment_transaction,
	:campaign_id
)
