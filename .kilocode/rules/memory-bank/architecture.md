# System Architecture

## High-Level Overview

The application is a Single Page Application (SPA) built with React. It uses a client-side routing strategy to manage navigation between different views (Dashboard, Students, Memberships, etc.). The UI is constructed using a component-based architecture, leveraging Tailwind CSS for styling and shadcn/ui for accessible, pre-built components.

## Project Structure

- **`src/`**: Source code root.
  - **`components/`**: Reusable UI components.
    - **`ui/`**: Low-level UI primitives (buttons, inputs, cards) from shadcn/ui.
    - **`dashboard/`**: Dashboard-specific chart components (StudentGrowthChart, RevenueChart, etc.).
    - **`Layout.tsx`**: The main application shell including the sidebar and header.
  - **`pages/`**: Top-level components representing distinct application routes.
    - `Dashboard.tsx`, `Students.tsx`, `StudentDetail.tsx`, `AdminDashboard.tsx`, `AdminLogin.tsx`, `Settings.tsx`, `Attendance.tsx`, `Schedule.tsx`, etc.
  - **`contexts/`**: React context providers (e.g., `AuthContext.tsx` for authentication).
  - **`hooks/`**: Custom React hooks for shared logic (e.g., `use-toast.ts`, `use-mobile.tsx`, `usePlatformSubscription.ts`).
  - **`lib/`**: Utility functions and helpers (e.g., `utils.ts` for class merging, `date.ts` for date handling).
  - **`integrations/`**: External service integrations (e.g., `supabase/` for Supabase client).
  - **`App.tsx`**: Main application component, defines the routing configuration.
  - **`main.tsx`**: Application entry point, mounts the React app to the DOM.
- **`supabase/`**: Supabase configuration and Edge Functions.
  - **`functions/`**: Serverless functions for backend logic (Stripe webhooks, checkout sessions, etc.).
  - **`migrations/`**: Database schema migrations.
  - **`config.toml`**: Supabase project configuration.

## Key Technical Decisions

- **Vite:** Chosen for its fast development server and optimized build process.
- **React Router:** Standard solution for declarative routing in React applications.
- **TanStack Query:** Used for efficient data fetching, caching, and state management of server data.
- **shadcn/ui & Tailwind CSS:** Provides a highly customizable and modern design system without the overhead of a heavy component library.
- **TypeScript:** Ensures type safety and improves developer experience with better tooling support.
- **Supabase RLS:** Strict Row Level Security policies enforce multi-tenancy, ensuring users can only access data belonging to their organization.
- **Supabase Edge Functions:** Serverless functions for secure backend operations (Stripe integration, payment processing, etc.).

## Data Flow

1.  **User Interaction:** User interacts with the UI (clicks, form submissions).
2.  **State Updates:** Local state is updated via React hooks; Server state is managed via TanStack Query mutations/queries.
3.  **Routing:** Navigation triggers route changes, rendering appropriate Page components.
4.  **Rendering:** Components re-render based on state or prop changes, updating the DOM.
5.  **Backend Operations:** Secure operations (payment processing, webhooks) are handled by Supabase Edge Functions.

## Database Schema

### `students` table

The `students` table is central to the application and stores all information related to a student.

- `id`: (uuid, primary key) - Unique identifier for the student.
- `organization_id`: (uuid, foreign key) - References the `organizations` table.
- `name`: (text) - Full name of the student.
- `email`: (text) - Email address.
- `phone`: (text) - Phone number.
- `address`: (text) - Street address.
- `city`: (text) - City.
- `state`: (text) - State/Province.
- `zip_code`: (text) - Postal code.
- `join_date`: (date) - The date the student joined the academy.
- `belt`: (enum: BeltRank) - Current belt rank (e.g., 'white', 'blue').
- `stripes`: (integer, default: 0) - Number of stripes on the current belt (0-4).
- `status`: (text) - The student's current status (e.g., 'student', 'trial').
- `membership_status`: (text) - The status of their membership (e.g., 'active', 'inactive', 'frozen').
- `membership_plan_id`: (integer, foreign key) - References the `membership_plans` table.
- `stripe_customer_id`: (text) - The Stripe Customer ID for payment processing.

### `organizations` table

Stores information about the BJJ academies (tenants).

- `id`: (uuid, primary key) - Unique identifier for the organization.
- `name`: (text) - Name of the academy.
- `stripe_account_id`: (text) - The connected Stripe Express account ID for payouts.
- `check_in_minutes_before`: (integer, default: 15) - Minutes before class start when check-in is allowed.
- `check_in_minutes_after`: (integer, default: 10) - Minutes after class start when check-in is allowed.
- `timezone`: (text) - Organization's timezone for accurate date/time displays.
- `created_at`: (timestamptz) - Creation timestamp.

### `platform_subscriptions` table

Manages the subscription status of academies to the platform itself.

- `id`: (uuid, primary key) - Unique identifier.
- `organization_id`: (uuid, foreign key) - References the `organizations` table.
- `stripe_subscription_id`: (text) - Stripe Subscription ID.
- `stripe_customer_id`: (text) - Stripe Customer ID (for the gym owner).
- `status`: (text) - Subscription status (e.g., 'active', 'inactive').
- `plan_id`: (text) - Identifier for the subscription plan.

### `membership_plans` table

Stores membership plan details.

- `id`: (uuid, primary key) - Unique identifier for the plan.
- `organization_id`: (uuid, foreign key) - References the `organizations` table.
- `name`: (text) - Plan name.
- `price`: (numeric) - Monthly price.
- `stripe_price_id`: (text) - Stripe Price ID for checkout.

### `schedules` table

Stores class schedule information.

- `id`: (uuid, primary key) - Unique identifier for the schedule.
- `organization_id`: (uuid, foreign key) - References the `organizations` table.
- `name`: (text) - Class name.
- `day_of_week`: (integer) - Day of week (0-6, Sunday-Saturday).
- `start_time`: (time) - Class start time.
- `end_time`: (time) - Class end time.

### `attendance` table

Stores student attendance records.

- `id`: (uuid, primary key) - Unique identifier.
- `organization_id`: (uuid, foreign key) - References the `organizations` table.
- `student_id`: (integer, foreign key) - References the `students` table.
- `schedule_id`: (uuid, foreign key) - References the `schedules` table.
- `date`: (date) - Date of attendance.
- `created_at`: (timestamptz) - Check-in timestamp.

## Supabase Edge Functions

The application uses Supabase Edge Functions for secure backend operations:

- **`stripe-webhook`**: Handles Stripe webhook events (payment.success, payment.failed, etc.)
- **`create-checkout-session`**: Creates Stripe checkout sessions for membership payments
- **`create-setup-session`**: Creates Stripe setup sessions for adding payment methods
- **`charge-student`**: Charges a student's saved payment method
- **`delete-payment-method`**: Removes a saved payment method
- **`set-default-payment-method`**: Sets the default payment method for a customer
- **`get-payment-methods`**: Retrieves saved payment methods for a customer
- **`create-stripe-connect-link`**: Creates Stripe Connect onboarding links
- **`complete-stripe-connect`**: Handles Stripe Connect OAuth callback
- **`disconnect-stripe-account`**: Disconnects a Stripe account from the organization
- **`create-platform-checkout-session`**: Creates checkout sessions for platform subscriptions
- **`cancel-subscription`**: Cancels a subscription
- **`verify-payment-and-update-student`**: Verifies payment and updates student membership status
- **`complete-signup`**: Completes user signup process
- **`delete-account`**: Handles account deletion requests
