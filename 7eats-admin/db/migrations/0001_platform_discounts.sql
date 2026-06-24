-- Platform-wide discounts. Additive-only. Safe to run once against the shared DB.

CREATE TYPE platform_discount_type AS ENUM ('percentage', 'fixed');

CREATE TABLE platform_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  description text,
  discount_type platform_discount_type NOT NULL,
  value numeric(10, 2) NOT NULL,
  max_discount_amount numeric(10, 2),
  min_order_subtotal numeric(10, 2),
  per_user_limit integer NOT NULL DEFAULT 1,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by text REFERENCES "user" (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_discounts_value_positive CHECK (value > 0),
  CONSTRAINT platform_discounts_percentage_max
    CHECK (discount_type <> 'percentage' OR value <= 100),
  CONSTRAINT platform_discounts_max_discount_positive
    CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  CONSTRAINT platform_discounts_min_subtotal_non_negative
    CHECK (min_order_subtotal IS NULL OR min_order_subtotal >= 0),
  CONSTRAINT platform_discounts_per_user_limit_positive CHECK (per_user_limit >= 1),
  CONSTRAINT platform_discounts_dates_order
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

ALTER TABLE platform_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_discounts_select_public ON platform_discounts
  FOR SELECT TO public
  USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );
CREATE POLICY platform_discounts_select_admin ON platform_discounts
  FOR SELECT TO public USING (auth.role() = 'admin');
CREATE POLICY platform_discounts_insert_admin ON platform_discounts
  FOR INSERT TO public WITH CHECK (auth.role() = 'admin');
CREATE POLICY platform_discounts_update_admin ON platform_discounts
  FOR UPDATE TO public USING (auth.role() = 'admin');
CREATE POLICY platform_discounts_delete_admin ON platform_discounts
  FOR DELETE TO public USING (auth.role() = 'admin');

ALTER TABLE orders
  ADD COLUMN platform_discount_id uuid REFERENCES platform_discounts (id) ON DELETE SET NULL,
  ADD COLUMN platform_discount_amount numeric(10, 2);

CREATE INDEX orders_platform_discount_client_idx
  ON orders (platform_discount_id, client_id);
