SELECT refund_transactions.* FROM
    refund_transactions
    INNER JOIN commitments
        ON refund_transactions.commitment_id = commitments.commitment_id
    INNER JOIN contribution_commitments
        ON contribution_commitments.commitment_id = commitments.commitment_id
    INNER JOIN contributions
        ON contributions.contribution_id = contribution_commitments.contribution_id
WHERE contributions.campaign_id = :campaign_id
