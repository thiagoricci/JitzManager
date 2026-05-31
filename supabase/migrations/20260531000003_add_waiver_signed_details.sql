-- Snapshot of the participant information submitted with the waiver signature
-- (full name, DOB, phone, email, minor flag, guardian name). Kept as JSONB so the
-- signed record stays faithful even if the live student record is edited later.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS waiver_signed_details JSONB;
