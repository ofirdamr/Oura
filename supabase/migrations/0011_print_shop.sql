-- §10.4 Print Shop: fulfillment routing + order management
-- §10.5 DB Schema Extensions

-- Fulfillment routing type
CREATE TYPE fulfillment_route_type AS ENUM ('AUTOMATED_WHOLESALE', 'SELF_FULFILLMENT');

-- Order status lifecycle
CREATE TYPE platform_order_status AS ENUM (
  'Awaiting_High_Res_Asset',
  'Ready_For_Photographer_Print',
  'Dispatched_To_Wholesaler',
  'Completed'
);

-- Print format
CREATE TYPE print_format_type AS ENUM ('magnet', 'print_10x15', 'block', 'photo_book');

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  guest_token TEXT NOT NULL,
  format print_format_type NOT NULL DEFAULT 'print_10x15',
  fulfillment_type fulfillment_route_type NOT NULL DEFAULT 'SELF_FULFILLMENT',
  order_status platform_order_status NOT NULL DEFAULT 'Awaiting_High_Res_Asset',
  quantity INT NOT NULL DEFAULT 1,
  price_agorot INT NOT NULL DEFAULT 0,
  guest_name TEXT,
  guest_phone TEXT,
  notes TEXT,
  marked_printed_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_orders_awaiting_assets ON public.orders (order_status)
  WHERE order_status = 'Awaiting_High_Res_Asset';
CREATE INDEX idx_orders_event ON public.orders (event_id);
CREATE INDEX idx_orders_photo ON public.orders (photo_id);

-- Auto-release: flip order to ready when original sync completes
CREATE OR REPLACE FUNCTION release_held_orders_on_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_original_uploaded = TRUE AND OLD.is_original_uploaded = FALSE THEN
    UPDATE public.orders
    SET order_status = 'Ready_For_Photographer_Print',
        updated_at = NOW()
    WHERE photo_id = NEW.id
      AND order_status = 'Awaiting_High_Res_Asset'
      AND fulfillment_type = 'SELF_FULFILLMENT';

    UPDATE public.orders
    SET order_status = 'Dispatched_To_Wholesaler',
        dispatched_at = NOW(),
        updated_at = NOW()
    WHERE photo_id = NEW.id
      AND order_status = 'Awaiting_High_Res_Asset'
      AND fulfillment_type = 'AUTOMATED_WHOLESALE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_release_orders_on_sync
AFTER UPDATE ON public.photos
FOR EACH ROW
EXECUTE FUNCTION release_held_orders_on_sync();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION update_orders_updated_at();

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Photographer sees orders for their own events only
CREATE POLICY "photographer_orders_select"
  ON public.orders FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE photographer_id = auth.uid()
    )
  );

-- Orders are inserted by the API via service role (guest, no auth)
-- Service role bypasses RLS — no insert policy needed for guests.
