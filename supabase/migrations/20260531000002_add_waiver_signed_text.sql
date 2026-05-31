-- Snapshot of the exact waiver text the student agreed to, captured at signing
-- time so the saved record stays faithful even if the gym edits its waiver later.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS waiver_signed_text TEXT;
