-- AgriS Compliance Assessment App
-- Logical/physical schema candidate v1.0-rc1
-- PostgreSQL / Neon compatible

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_schema_version (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_schema_version(version) VALUES ('1.0-rc1') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  unit_type text NOT NULL,
  parent_id uuid REFERENCES org_units(id),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL CHECK (actor_type IN ('person','team','org_unit','service_account')),
  name text NOT NULL,
  org_unit_id uuid REFERENCES org_units(id),
  auth_subject text,
  email text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS actors_auth_subject_uq ON actors(auth_subject) WHERE auth_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS compliance_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  version text,
  effective_from date,
  effective_to date,
  owner_actor_id uuid REFERENCES actors(id),
  owner_text text,
  status text NOT NULL DEFAULT 'draft',
  supersedes_id uuid REFERENCES compliance_sources(id),
  source_uri text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code, version)
);

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  owner_actor_id uuid REFERENCES actors(id),
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code, version)
);

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  source_id uuid REFERENCES compliance_sources(id),
  source_clause text,
  parent_id uuid REFERENCES compliance_requirements(id),
  assessable boolean NOT NULL DEFAULT true,
  mandatory_level text NOT NULL DEFAULT 'mandatory',
  test_procedure text,
  expected_evidence text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS framework_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id),
  sort_order integer,
  applicability_rule jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(framework_id, requirement_id)
);

CREATE TABLE IF NOT EXISTS control_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  control_type text,
  frequency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requirement_control_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  control_reference_id uuid NOT NULL REFERENCES control_references(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'expected',
  UNIQUE(requirement_id, control_reference_id)
);

CREATE TABLE IF NOT EXISTS existing_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_reference_id uuid REFERENCES control_references(id),
  org_unit_id uuid REFERENCES org_units(id),
  name text NOT NULL,
  owner_actor_id uuid REFERENCES actors(id),
  status text NOT NULL DEFAULT 'active',
  frequency text,
  design_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

