# Tasks Documentation

This file documents repetitive workflows and patterns used throughout the project to streamline future development.

---

## Add New Page/Route

**Purpose:** Add a new page to the application with routing

**Files to modify:**

- `src/App.tsx` - Add route definition
- `src/pages/[NewPage].tsx` - Create new page component
- `src/components/NavLink.tsx` - Add navigation link (if needed)

**Steps:**

1. Create new page component in `src/pages/` directory
2. Add route in `src/App.tsx` inside the `<Routes>` component
3. Wrap with `<ProtectedRoute>` and `<Layout>` if it requires authentication
4. Add navigation link in sidebar via `NavLink` component if needed

**Example:**

```tsx
// In src/App.tsx
<Route
  path="/new-page"
  element={
    <ProtectedRoute>
      <Layout>
        <NewPage />
      </Layout>
    </ProtectedRoute>
  }
/>;

// In src/pages/NewPage.tsx
export default function NewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          New Page
        </h2>
        <p className="text-muted-foreground">Page description</p>
      </div>
      {/* Page content */}
    </div>
  );
}
```

---

## Add Supabase Edge Function

**Purpose:** Create a new serverless function for backend operations

**Files to modify:**

- `supabase/functions/[function-name]/index.ts` - Create new edge function

**Steps:**

1. Create new directory in `supabase/functions/` with function name
2. Create `index.ts` file in the new directory
3. Import necessary dependencies and CORS handler from `_shared/cors.ts`
4. Implement the function logic with proper error handling
5. Deploy using Supabase CLI: `supabase functions deploy [function-name]`

**Example:**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Function logic here
    const { data, error } = await supabaseClient.from("table_name").select("*");

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## Create Database Migration

**Purpose:** Add or modify database schema

**Files to modify:**

- `supabase/migrations/[timestamp]_[description].sql` - Create new migration file

**Steps:**

1. Create new migration file with timestamp prefix (format: YYYYMMDDHHMMSS)
2. Write SQL for schema changes
3. Apply migration: `supabase db push`
4. Test locally: `supabase db reset` (if needed)

**Important notes:**

- Always include RLS policies for new tables
- Use UUIDs for primary keys
- Add proper indexes for frequently queried columns
- Include foreign key constraints with cascade delete where appropriate

**Example:**

```sql
-- Create new table
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can view own organization data"
ON new_table
FOR SELECT
USING (auth.uid() IN (
  SELECT id FROM profiles WHERE organization_id = new_table.organization_id
));
```

---

## Add New Dashboard Chart

**Purpose:** Create a new chart component for the dashboard

**Files to modify:**

- `src/components/dashboard/[ChartName].tsx` - Create new chart component
- `src/pages/Dashboard.tsx` - Import and use the chart

**Steps:**

1. Create new chart component in `src/components/dashboard/`
2. Use Recharts for visualization
3. Fetch data using TanStack Query
4. Import and render in `Dashboard.tsx`

**Example:**

```tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function NewChart() {
  const { data } = useQuery({
    queryKey: ["chart-data"],
    queryFn: async () => {
      const { data } = await supabase.from("table").select("*");
      return data;
    },
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

## Add shadcn/ui Component

**Purpose:** Add a new UI component from shadcn/ui

**Steps:**

1. Run the shadcn CLI command: `npx shadcn@latest add [component-name]`
2. The component will be automatically added to `src/components/ui/`
3. Import and use in your components

**Available components:** button, input, card, dialog, dropdown-menu, select, table, etc.

---

## Add New Database Table with RLS

**Purpose:** Create a new multi-tenant table with proper security

**Files to modify:**

- `supabase/migrations/[timestamp]_create_[table_name].sql` - Create migration

**Steps:**

1. Create table with `organization_id` foreign key
2. Enable Row Level Security
3. Create RLS policies for SELECT, INSERT, UPDATE, DELETE
4. Add CASCADE DELETE to foreign key referencing organizations

**Example:**

```sql
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Allow users to view their organization's data
CREATE POLICY "Users can view own organization data"
ON new_table
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow users to insert data for their organization
CREATE POLICY "Users can insert own organization data"
ON new_table
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow users to update their organization's data
CREATE POLICY "Users can update own organization data"
ON new_table
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow users to delete their organization's data
CREATE POLICY "Users can delete own organization data"
ON new_table
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);
```

---

## Update Student Status

**Purpose:** Change a student's status (trial, active, inactive, frozen)

**Files to modify:**

- Student detail page or component handling the status change
- Use TanStack Query mutation for the update

**Steps:**

1. Create mutation using `useMutation` from TanStack Query
2. Call `supabase.from("students").update().eq()`
3. Invalidate queries to refresh data
4. Show success/error toast notifications

**Example:**

```tsx
const updateStatusMutation = useMutation({
  mutationFn: async ({
    studentId,
    status,
  }: {
    studentId: string;
    status: string;
  }) => {
    const { error } = await supabase
      .from("students")
      .update({ status })
      .eq("id", studentId);

    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["students"] });
    toast.success("Status updated successfully");
  },
  onError: (error) => {
    toast.error(`Error updating status: ${error.message}`);
  },
});
```

---

## Handle Stripe Payment

**Purpose:** Process payments through Stripe integration

**Files to modify:**

- Edge Function: `supabase/functions/create-checkout-session/index.ts` (or similar)
- Frontend: Component initiating payment

**Steps:**

1. Create checkout session via Edge Function
2. Redirect user to Stripe Checkout
3. Handle webhook events in `stripe-webhook` function
4. Update database based on payment status

**Important notes:**

- Never handle payment secrets on the frontend
- Always use Edge Functions for Stripe API calls
- Verify webhook signatures for security
- Handle both success and failure scenarios

---

## Add Timezone Support

**Purpose:** Ensure dates display correctly based on organization's timezone

**Files to modify:**

- Components displaying dates
- Use utilities from `src/lib/date.ts`

**Steps:**

1. Get organization timezone from context or auth
2. Use `formatDate()` helper from `src/lib/date.ts`
3. Pass timezone to date formatting functions

**Example:**

```tsx
import { formatDate } from "@/lib/date";
import { useAuth } from "@/contexts/AuthContext";

export default function MyComponent() {
  const { organization } = useAuth();
  const timezone = organization?.timezone || "UTC";

  return <div>{formatDate(new Date(), timezone, "MMMM do, yyyy")}</div>;
}
```
