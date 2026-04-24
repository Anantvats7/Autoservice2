
DROP POLICY IF EXISTS "notifications_insert_any_authed" ON public.notifications;
CREATE POLICY "notifications_insert_restricted" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'manager') 
    OR public.has_role(auth.uid(), 'employee')
  );
