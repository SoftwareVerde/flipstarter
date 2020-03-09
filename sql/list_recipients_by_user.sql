SELECT *
FROM recipients
LEFT JOIN users USING (user_id)
WHERE user_id = :user_id
GROUP BY recipient_id
