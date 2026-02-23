-- Supabase schema updates for Gurj Bakery
-- Run this in SQL editor.

-- =========================
-- ORDERS TABLE ENHANCEMENTS
-- =========================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_mode text NOT NULL DEFAULT 'pickup' CHECK (order_mode IN ('pickup', 'delivery')),
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS order_status text NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'delivered', 'cancelled')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'done')),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.set_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_orders_updated_at();

-- Normalize old text-based pickup records if available.
UPDATE public.orders
SET order_mode = CASE
  WHEN lower(coalesce(pickup, '')) LIKE 'delivery%' THEN 'delivery'
  ELSE 'pickup'
END
WHERE order_mode IS NULL OR order_mode NOT IN ('pickup', 'delivery');

-- Pickup default location.
UPDATE public.orders
SET address = 'Always Shine Location'
WHERE order_mode = 'pickup' AND coalesce(trim(address), '') = '';

-- ============================
-- MENU ITEMS TABLE ENHANCEMENT
-- ============================
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'veg' CHECK (item_type IN ('veg', 'non_veg')),
  ADD COLUMN IF NOT EXISTS meat_type text NOT NULL DEFAULT 'veg' CHECK (meat_type IN ('veg', 'non_veg')),
  ADD COLUMN IF NOT EXISTS is_cake boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weight_options jsonb NOT NULL DEFAULT '["0.5 kg", "1 kg", "2 kg"]'::jsonb,
  ADD COLUMN IF NOT EXISTS egg_options jsonb NOT NULL DEFAULT '["egg", "eggless"]'::jsonb;

-- Optional index for admin filtering.
CREATE INDEX IF NOT EXISTS idx_orders_status_mode ON public.orders(order_status, payment_status, order_mode);
