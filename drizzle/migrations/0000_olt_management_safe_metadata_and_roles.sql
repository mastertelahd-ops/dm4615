CREATE TABLE public.user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('admin','operator')),
 UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_role_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
INSERT INTO public.user_roles (user_id, role) SELECT user_id, 'admin' FROM public.admin_profiles WHERE role = 'admin' ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.is_active_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.admin_profiles ap ON ap.user_id = ur.user_id WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ap.is_active = true);
$$;
REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, service_role;
COMMENT ON COLUMN public.admin_profiles.role IS 'DEPRECATED for authorization: canonical roles are stored in public.user_roles; kept for backward compatible UI.';
ALTER TABLE public.olt_devices ADD COLUMN ssh_username text, ADD COLUMN credential_ref text, ADD COLUMN timeout_seconds integer NOT NULL DEFAULT 10 CHECK (timeout_seconds BETWEEN 3 AND 30), ADD COLUMN is_selected boolean NOT NULL DEFAULT false, ADD COLUMN last_test_at timestamptz, ADD COLUMN last_status text, ADD COLUMN last_latency_ms integer, ADD COLUMN last_error text;
CREATE UNIQUE INDEX olt_devices_one_selected ON public.olt_devices (is_selected) WHERE is_selected = true;
CREATE OR REPLACE FUNCTION public.select_active_olt(_olt_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
 IF NOT public.is_active_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(46153333);
 IF NOT EXISTS (SELECT 1 FROM public.olt_devices WHERE id = _olt_id AND enabled) THEN RAISE EXCEPTION 'OLT inactive or missing'; END IF;
 UPDATE public.olt_devices SET is_selected = false WHERE is_selected;
 UPDATE public.olt_devices SET is_selected = true WHERE id = _olt_id;
END;
$$;
REVOKE ALL ON FUNCTION public.select_active_olt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_active_olt(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.audit_olt_metadata_change() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
 INSERT INTO public.audit_events (actor_user_id,event_type,entity_type,entity_id,details) VALUES (auth.uid(), 'olt.' || lower(TG_OP), 'olt', COALESCE(NEW.id,OLD.id), jsonb_build_object('name',COALESCE(NEW.name,OLD.name),'metadata_only',true));
 RETURN COALESCE(NEW,OLD);
END;
$$;
CREATE TRIGGER olt_metadata_audit AFTER INSERT OR UPDATE OR DELETE ON public.olt_devices FOR EACH ROW EXECUTE FUNCTION public.audit_olt_metadata_change();