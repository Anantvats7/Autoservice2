-- 1. Extend booking_status enum
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'ready_for_pickup';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'released';

-- 2. Bookings: handoff codes, multi-service support
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS dropoff_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS pickup_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS extra_service_ids uuid[] NOT NULL DEFAULT '{}';

-- Generate codes for new bookings automatically
CREATE OR REPLACE FUNCTION public.gen_booking_codes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dropoff_code IS NULL THEN
    NEW.dropoff_code := 'DROP-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));
  END IF;
  IF NEW.pickup_code IS NULL THEN
    NEW.pickup_code := 'PICK-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_codes_trg ON public.bookings;
CREATE TRIGGER bookings_codes_trg
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.gen_booking_codes();

-- Backfill existing rows
UPDATE public.bookings
  SET dropoff_code = 'DROP-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8))
  WHERE dropoff_code IS NULL;
UPDATE public.bookings
  SET pickup_code = 'PICK-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8))
  WHERE pickup_code IS NULL;

-- 3. Vehicles: brand logo
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS brand_logo_url text;

-- 4. Service reminders table
CREATE TABLE IF NOT EXISTS public.service_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  due_date date NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reminders_select_own ON public.service_reminders;
CREATE POLICY reminders_select_own ON public.service_reminders
  FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'employee'));

DROP POLICY IF EXISTS reminders_insert_staff ON public.service_reminders;
CREATE POLICY reminders_insert_staff ON public.service_reminders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'employee'));

DROP POLICY IF EXISTS reminders_update_own ON public.service_reminders;
CREATE POLICY reminders_update_own ON public.service_reminders
  FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id OR public.has_role(auth.uid(),'manager'));

-- 5. Allow employees to create walk-in bookings
DROP POLICY IF EXISTS bookings_insert_customer_or_manager ON public.bookings;
CREATE POLICY bookings_insert_staff_or_customer ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'employee')
  );

-- 6. Auto-update updated_at triggers (the function already exists)
DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS vehicles_updated_at ON public.vehicles;
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS services_updated_at ON public.services;
CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS inventory_updated_at ON public.inventory;
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Realtime publication for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_reminders;