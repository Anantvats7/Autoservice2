
CREATE OR REPLACE FUNCTION public.create_history_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'released') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Only insert if no history already exists for this booking
    IF NOT EXISTS (SELECT 1 FROM public.service_history WHERE booking_id = NEW.id) THEN
      INSERT INTO public.service_history (
        booking_id, customer_id, vehicle_id, service_id, technician_id,
        service_date, cost, notes
      ) VALUES (
        NEW.id, NEW.customer_id, NEW.vehicle_id, NEW.service_id, NEW.assigned_to,
        COALESCE(NEW.released_at, now()), COALESCE(NEW.total_cost, 0), NEW.notes
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_history_on_completion ON public.bookings;
CREATE TRIGGER trg_create_history_on_completion
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.create_history_on_completion();
