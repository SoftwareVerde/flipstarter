/* Add the initial campaign (from 2020-02-01 to 2020-03-21)*/
INSERT OR IGNORE INTO campaigns (campaign_id, starts, expires) VALUES (1, 1580508000, 1584748799);

/* Add the recipient. */
INSERT OR IGNORE INTO users (user_id, user_url, user_image, user_alias, user_address) VALUES (1, 'https://twitter.com/monsterbitar', 'https://pbs.twimg.com/profile_images/490950516973637633/LkJHQeNM_400x400.png', 'Jonathan Silverblood', 'bitcoincash:qr4aadjrpu73d2wxwkxkcrt6gqxgu6a7usxfm96fst');

/* Link recipient to the initial campaign. */
INSERT OR IGNORE INTO recipients (recipient_id, recipient_satoshis, user_id, campaign_id) VALUES (1, 2000000, 1, 1);

/**********************************************/

/* Add the initial campaign (from 2020-02-01 to 2020-02-28)*/
INSERT OR IGNORE INTO campaigns (campaign_id, starts, expires) VALUES (2, 1584230400, 1585439999);

/* Add both EatBCH projects as users. */
INSERT OR IGNORE INTO users (user_id, user_url, user_image, user_alias, user_address) VALUES (2, 'https://eatbch.org/venezuela/', 'https://eatbch.org/_assets/img/venezuela-hero-wide.jpg?0.0.11', 'EatBCH Venezuela',  'bitcoincash:ppwk8u8cg8cthr3jg0czzays6hsnysykes9amw07kv');
INSERT OR IGNORE INTO users (user_id, user_url, user_image, user_alias, user_address) VALUES (3, 'https://eatbch.org/south-sudan/', 'https://eatbch.org/_assets/img/south-sudan-hero-wide.jpg?0.0.11', 'EatBCH South Sudan', 'bitcoincash:qrsrvtc95gg8rrag7dge3jlnfs4j9pe0ugrmeml950');

/* Link both EathBCH projects as recipient to the initial campaign. */
INSERT OR IGNORE INTO recipients (recipient_id, recipient_satoshis, user_id, campaign_id) VALUES (2,  700000000, 2, 2);
INSERT OR IGNORE INTO recipients (recipient_id, recipient_satoshis, user_id, campaign_id) VALUES (3, 1300000000, 3, 2);
