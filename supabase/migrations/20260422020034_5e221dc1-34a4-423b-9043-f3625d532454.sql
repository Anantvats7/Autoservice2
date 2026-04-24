-- Function: notify all managers about a new booking
CREATE OR REPLACE FUNCTION public.notify_managers_new_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cust_name text;
BEGIN
  SELECT full_name INTO cust_name FROM public.profiles WHERE user_id = NEW.customer_id;
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT ur.user_id,
         'New Booking Received',
         'New booking from ' || COALESCE(cust_name, 'a customer') || ' — #' || upper(substr(NEW.id::text, 1, 6)),
         'info'
  FROM public.user_roles ur
  WHERE ur.role = 'manager';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_managers_new_booking ON public.bookings;
CREATE TRIGGER trg_notify_managers_new_booking
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_managers_new_booking();

-- Function: notify managers about a new customer
CREATE OR REPLACE FUNCTION public.notify_managers_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire for customer-role profiles
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'customer') THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT ur.user_id,
           'New Customer Registered',
           COALESCE(NEW.full_name, 'A new customer') || ' just joined AutoServe.',
           'info'
    FROM public.user_roles ur
    WHERE ur.role = 'manager';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_managers_new_customer ON public.profiles;
CREATE TRIGGER trg_notify_managers_new_customer
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_managers_new_customer();

-- Also notify when a user is given the customer role (handles signup ordering)
CREATE OR REPLACE FUNCTION public.notify_managers_new_customer_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cust_name text;
BEGIN
  IF NEW.role = 'customer' THEN
    SELECT full_name INTO cust_name FROM public.profiles WHERE user_id = NEW.user_id;
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT ur.user_id,
           'New Customer Registered',
           COALESCE(cust_name, 'A new customer') || ' just joined AutoServe.',
           'info'
    FROM public.user_roles ur
    WHERE ur.role = 'manager'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = ur.user_id
      AND n.title = 'New Customer Registered'
      AND n.created_at > now() - interval '5 seconds'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_managers_new_customer_role ON public.user_roles;
CREATE TRIGGER trg_notify_managers_new_customer_role
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.notify_managers_new_customer_role();