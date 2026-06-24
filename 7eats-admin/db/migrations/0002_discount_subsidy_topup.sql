-- Platform-funded discount top-up so the cook is paid in full when a platform
-- discount exceeds the platform fee. Additive-only. Safe to run once.

ALTER TABLE order_payments
  ADD COLUMN platform_subsidy_amount numeric(10, 2),
  ADD COLUMN stripe_topup_transfer_id text;
