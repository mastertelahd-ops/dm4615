-- DM4615 Lovable Cloud schema baseline.
-- Applied to the Lovable-managed PostgreSQL database on 2026-11-15.
-- All application tables are protected by RLS. No public/anon access is granted.
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_code text UNIQUE,
  full_name text NOT NULL,
  document_number text UNIQUE,
  email text,
  phone text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  download_mbps integer NOT NULL CHECK (download_mbps > 0),
  upload_mbps integer NOT NULL CHECK (upload_mbps > 0),
  price numeric(12,2) CHECK (price IS NULL OR price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.olt_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  vendor text NOT NULL DEFAULT 'Datacom',
  model text NOT NULL DEFAULT 'DM4615',
  management_host text,
  management_port integer NOT NULL DEFAULT 22 CHECK (management_port BETWEEN 1 AND 65535),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor, model, management_host)
);
CREATE TABLE IF NOT EXISTS public.pon_ports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  olt_id uuid NOT NULL REFERENCES public.olt_devices(id) ON DELETE RESTRICT,
  interface_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (olt_id, interface_name)
);
CREATE TABLE IF NOT EXISTS public.onus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  service_plan_id uuid REFERENCES public.service_plans(id) ON DELETE RESTRICT,
  olt_id uuid REFERENCES public.olt_devices(id) ON DELETE RESTRICT,
  pon_port_id uuid REFERENCES public.pon_ports(id) ON DELETE RESTRICT,
  onu_number integer,
  profile_type text CHECK (profile_type IN ('bridge','router')),
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected','unregistered','pending_approval','provisioning','online','offline','blocked','decommissioned')),
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.onu_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onu_id uuid REFERENCES public.onus(id) ON DELETE SET NULL,
  serial_number text NOT NULL,
  olt_id uuid REFERENCES public.olt_devices(id) ON DELETE SET NULL,
  pon_port_id uuid REFERENCES public.pon_ports(id) ON DELETE SET NULL,
  observed_status text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.provisioning_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onu_id uuid NOT NULL REFERENCES public.onus(id) ON DELETE RESTRICT,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_pon_port_id uuid REFERENCES public.pon_ports(id) ON DELETE RESTRICT,
  profile_type text NOT NULL CHECK (profile_type IN ('bridge','router')),
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','rejected','executing','succeeded','failed','cancelled')),
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_note text,
  approved_at timestamptz,
  executed_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.provisioning_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.provisioning_requests(id) ON DELETE CASCADE,
  step_order integer NOT NULL CHECK (step_order > 0),
  step_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','skipped')),
  command_name text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, step_order)
);
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','operator','viewer')),
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  outcome text NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','failure','denied')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.customer_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  service_plan_id uuid NOT NULL REFERENCES public.service_plans(id) ON DELETE RESTRICT,
  onu_id uuid REFERENCES public.onus(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.onu_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  profile_type text NOT NULL CHECK (profile_type IN ('bridge','router')),
  vendor text NOT NULL,
  model text,
  firmware_min text,
  firmware_max text,
  config_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_validated boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
CREATE INDEX IF NOT EXISTS idx_onus_customer_id ON public.onus(customer_id);
CREATE INDEX IF NOT EXISTS idx_onus_pon_status ON public.onus(pon_port_id, status);
CREATE INDEX IF NOT EXISTS idx_observations_serial_time ON public.onu_observations(serial_number, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_provisioning_status_created ON public.provisioning_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provisioning_steps_request ON public.provisioning_steps(request_id, step_order);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_services_customer_status ON public.customer_services(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_services_onu ON public.customer_services(onu_id);
CREATE INDEX IF NOT EXISTS idx_profiles_type_active ON public.onu_profiles(profile_type, is_active);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olt_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pon_ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onu_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisioning_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisioning_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onu_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles ap
    WHERE ap.user_id = auth.uid()
      AND ap.is_active = true
      AND ap.role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','service_plans','olt_devices','pon_ports','onus',
    'onu_observations','provisioning_requests','provisioning_steps',
    'customer_services','onu_profiles'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_full_access ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY admin_full_access ON public.%I FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin())',
      t
    );
  END LOOP;
END $$;
DROP POLICY IF EXISTS admin_profile_read ON public.admin_profiles;
CREATE POLICY admin_profile_read ON public.admin_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_active_admin());
DROP POLICY IF EXISTS audit_admin_read ON public.audit_events;
CREATE POLICY audit_admin_read ON public.audit_events FOR SELECT TO authenticated
USING (public.is_active_admin());
DROP POLICY IF EXISTS audit_admin_insert ON public.audit_events;
CREATE POLICY audit_admin_insert ON public.audit_events FOR INSERT TO authenticated
WITH CHECK (public.is_active_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers, public.service_plans,
  public.olt_devices, public.pon_ports, public.onus, public.onu_observations,
  public.provisioning_requests, public.provisioning_steps, public.customer_services,
  public.onu_profiles TO authenticated;
GRANT SELECT ON public.admin_profiles TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
