-- Schedule the daily dunning run (issue #7).
--
-- This is the "scheduled-jobs substrate": pg_cron ticks once a day and uses
-- pg_net to POST to the process-dunning edge function. Future automations can
-- follow the same pattern.
--
-- ONE-TIME SETUP (run once in the Supabase SQL editor, with real values):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- Then re-run this migration (supabase db push) so the schedule can read them.
--
-- The whole thing is guarded on pg_cron being available, so it is a harmless
-- no-op on the plain Postgres used by the RLS test harness (extensions absent →
-- the body is never reached). It is also idempotent: re-running replaces the job.

DO $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not available; skipping dunning schedule (expected in test/local Postgres).';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'Vault secrets project_url/service_role_key not set; skipping dunning schedule. See this migration''s header for setup.';
    RETURN;
  END IF;

  -- Replace any prior schedule so this migration is idempotent.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-dunning-daily') THEN
    PERFORM cron.unschedule('process-dunning-daily');
  END IF;

  -- Daily at 08:00 UTC: POST to the process-dunning function, authorized with the
  -- service-role key (the function rejects callers without it).
  PERFORM cron.schedule(
    'process-dunning-daily',
    '0 8 * * *',
    format(
      $cron$
        SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );
      $cron$,
      v_url || '/functions/v1/process-dunning',
      v_key
    )
  );

  RAISE NOTICE 'Scheduled process-dunning-daily.';
END $$;
