
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('manager', 'employee', 'customer');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.booking_priority AS ENUM ('normal', 'express', 'priority');

-- ============ UTILITY FUNCTION ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY 
    CASE role WHEN 'manager' THEN 1 WHEN 'employee' THEN 2 ELSE 3 END LIMIT 1
$$;

-- ============ VEHICLES ============
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  registration TEXT NOT NULL UNIQUE,
  color TEXT,
  mileage INTEGER NOT NULL DEFAULT 0,
  fuel_type TEXT DEFAULT 'Petrol',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SERVICES ============
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INVENTORY ============
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ BOOKINGS ============
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id),
  assigned_to UUID REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  priority booking_priority NOT NULL DEFAULT 'normal',
  notes TEXT,
  total_cost NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bookings_customer ON public.bookings(customer_id);
CREATE INDEX idx_bookings_assigned ON public.bookings(assigned_to);
CREATE INDEX idx_bookings_status ON public.bookings(status);

-- ============ SERVICE HISTORY ============
CREATE TABLE public.service_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id),
  technician_id UUID REFERENCES auth.users(id),
  service_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  mileage_at_service INTEGER,
  parts_used TEXT,
  notes TEXT,
  cost NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_history_customer ON public.service_history(customer_id);
CREATE INDEX idx_history_vehicle ON public.service_history(vehicle_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "profiles_select_own_or_staff" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'employee'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own_or_manager" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'manager'));

-- user_roles
CREATE POLICY "roles_select_own_or_manager" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "roles_manage_by_manager" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- vehicles
CREATE POLICY "vehicles_select" ON public.vehicles FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'employee'));
CREATE POLICY "vehicles_insert_own" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "vehicles_update_own_or_manager" ON public.vehicles FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "vehicles_delete_own_or_manager" ON public.vehicles FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'manager'));

-- services
CREATE POLICY "services_select_all" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "services_manage_manager" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- inventory
CREATE POLICY "inventory_select_staff" ON public.inventory FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'employee'));
CREATE POLICY "inventory_manage_manager" ON public.inventory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "inventory_update_employee" ON public.inventory FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

-- bookings
CREATE POLICY "bookings_select" ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = assigned_to OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'employee'));
CREATE POLICY "bookings_insert_customer_or_manager" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "bookings_update" ON public.bookings FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = assigned_to OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'employee'));
CREATE POLICY "bookings_delete_manager" ON public.bookings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR auth.uid() = customer_id);

-- service_history
CREATE POLICY "history_select" ON public.service_history FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = technician_id OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'employee'));
CREATE POLICY "history_insert_staff" ON public.service_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'employee'));
CREATE POLICY "history_update_manager" ON public.service_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- notifications
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_any_authed" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'customer'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
