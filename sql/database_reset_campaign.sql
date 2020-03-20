-- NOTE: This set of instructions clears up a campaign and resets it to it's default status by removing all fullfillments, contributions, commitments and recovations.
-- NOTE: You need to change the campaign_id in all queries below to use it for the desired campaign.

-- Remove all recovations for this campaign.
DELETE FROM revocations
WHERE commitment_id IN (
	SELECT commitment_id
	FROM commitments
	LEFT JOIN contributionCommitments USING (commitment_id)
	LEFT JOIN contributions USING (contribution_id)
	WHERE campaign_id = 1);

-- Remove all commitments for this campaign.
DELETE FROM commitments
WHERE commitment_id IN (
	SELECT commitment_id
	FROM contributionCommitments
	LEFT JOIN contributions USING (contribution_id)
	WHERE campaign_id = 1);

-- Remove all links to the commits for this campaign.
DELETE FROM contributionCommitments
WHERE contribution_id IN (
	SELECT contribution_id
	FROM contributions
	WHERE campaign_id = 1);

-- Remove the all contributions for this campaign.
DELETE FROM contributions WHERE campaign_id = 1;

-- Remove all fullfillments for this campaign.
DELETE FROM fullfillments WHERE campaign_id = 1;
