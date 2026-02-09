SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'subscription_history';
