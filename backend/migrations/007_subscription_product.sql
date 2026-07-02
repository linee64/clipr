-- Add product_id to the subscriptions table to track which plan the user is on.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS product_id TEXT;
