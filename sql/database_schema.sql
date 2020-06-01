CREATE TABLE IF NOT EXISTS users
(
	user_id INTEGER NOT NULL,
	user_url TEXT NULL,
	user_image TEXT NULL,
	user_alias TEXT NULL,
	user_address TEXT NULL,
	data_signature TEXT NULL,
	PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS campaigns
(
	campaign_id INTEGER NOT NULL,
	title TEXT NOT NULL,
	starts INTEGER NOT NULL,
	expires INTEGER NOT NULL,
	PRIMARY KEY (campaign_id)
);

CREATE TABLE IF NOT EXISTS fullfillments
(
	fullfillment_id INTEGER NOT NULL,
	fullfillment_timestamp INTEGER NOT NULL,
	fullfillment_transaction TEXT NOT NULL,
	campaign_id INTEGER NOT NULL,
	PRIMARY KEY (fullfillment_id),
	UNIQUE (campaign_id),
	FOREIGN KEY (campaign_id) REFERENCES campaigns (campaign_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS recipients
(
	recipient_id INTEGER NOT NULL,
	recipient_satoshis INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	campaign_id INTEGER NOT NULL,
	PRIMARY KEY (recipient_id),
	UNIQUE (campaign_id, user_id),
	FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
	FOREIGN KEY (campaign_id) REFERENCES campaigns (campaign_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS revocations
(
	revocation_id INTEGER NOT NULL,
	revocation_timestamp INTEGER NOT NULL,
	revocation_transaction TEXT NOT NULL,
	commitment_id INTEGER NOT NULL,
	PRIMARY KEY (revocation_id),
	FOREIGN KEY (commitment_id) REFERENCES commitments (commitment_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS commitments
(
	commitment_id INTEGER NOT NULL,
	previous_transaction_hash BLOB NOT NULL,
	previous_transaction_index INTEGER NOT NULL,
	unlock_script BLOB NOT NULL,
	sequence_number INTEGER NOT NULL DEFAULT X'FFFFFFFF',
	satoshis INTEGER NOT NULL,
	PRIMARY KEY (commitment_id),
	UNIQUE (previous_transaction_hash, previous_transaction_index)
);

CREATE TABLE IF NOT EXISTS contributions
(
	contribution_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	campaign_id INTEGER NOT NULL,
	contribution_timestamp INTEGER NOT NULL,
	contribution_comment TEXT NOT NULL DEFAULT '',
	PRIMARY KEY (contribution_id),
	FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
	FOREIGN KEY (campaign_id) REFERENCES campaigns (campaign_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS contributionCommitments
(
	contribution_id INTEGER NOT NULL,
	commitment_id INTEGER NOT NULL,
	UNIQUE(contribution_id, commitment_id),
	FOREIGN KEY (contribution_id) REFERENCES contributions (contribution_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
	FOREIGN KEY (commitment_id) REFERENCES commitments (commitment_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
