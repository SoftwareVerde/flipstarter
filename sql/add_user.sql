INSERT OR ROLLBACK INTO users
(
	user_url,
	user_image,
	user_alias,
	user_address,
	data_signature
)
VALUES
(
	:user_url,
	:user_image,
	:user_alias,
	:user_address,
	:data_signature
)
