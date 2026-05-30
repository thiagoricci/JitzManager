-- Enable RLS on payments table if not already enabled
alter table payments enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Users can view payments for their organization" on payments;
drop policy if exists "Users can insert payments for their organization" on payments;

-- Create policies using profiles table
create policy "Users can view payments for their organization"
  on payments for select
  using (
    organization_id in (
      select organization_id from profiles
      where id = auth.uid()
    )
  );

-- Although inserts are mostly done via Edge Functions (Service Role), 
-- adding insert policy for completeness if client-side inserts are ever needed
create policy "Users can insert payments for their organization"
  on payments for insert
  with check (
    organization_id in (
      select organization_id from profiles
      where id = auth.uid()
    )
  );