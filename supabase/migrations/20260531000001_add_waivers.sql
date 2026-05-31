-- Digital liability waiver: per-student signing status + token, per-gym waiver text.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS waiver_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS waiver_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS waiver_signed_name TEXT,
  ADD COLUMN IF NOT EXISTS waiver_token UUID NOT NULL DEFAULT gen_random_uuid();

-- The waiver link is shared publicly, so it must be an unguessable token (not the
-- sequential student id). Enforce uniqueness so a token resolves to one student.
CREATE UNIQUE INDEX IF NOT EXISTS students_waiver_token_idx ON public.students(waiver_token);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS waiver_text TEXT;
