# Technical Documentation

## Technologies Used

### Core

- **Runtime:** Node.js (Development)
- **Framework:** React v18
- **Language:** TypeScript v5
- **Build Tool:** Vite v5

### UI & Styling

- **Styling Engine:** Tailwind CSS v3
- **Component Library:** shadcn/ui (based on Radix UI primitives)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Animations:** tailwindcss-animate

### State Management & Data Fetching

- **Server State:** TanStack Query (React Query) v5
- **Local State:** React Hooks (useState, useReducer, useContext)

### Routing

- **Router:** React Router DOM v6

### Forms & Validation

- **Form Handling:** React Hook Form
- **Validation:** Zod

### Utilities

- **Date Handling:** date-fns, date-fns-tz
- **Toast Notifications:** Sonner, Radix UI Toast
- **Class Merging:** clsx, tailwind-merge
- **CSV Parsing:** PapaParse
- **Input Masking:** react-imask

### Backend & Database

- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Real-time:** Supabase Realtime
- **Edge Functions:** Supabase Edge Functions (Deno runtime)
- **Payments:** Stripe

## Development Setup

### Prerequisites

- Node.js & npm (or bun/yarn/pnpm)
- Supabase CLI (for local development and migrations)

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Development Build

```bash
npm run build:dev
```

### Linting

```bash
npm run lint
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

The project follows a standard Vite + React structure with a `src` directory containing all application code.

- `src/components`: Reusable UI components
  - `ui/`: shadcn/ui primitives
  - `dashboard/`: Dashboard-specific chart components
- `src/pages`: Route components
- `src/contexts`: React context providers
- `src/hooks`: Custom hooks
- `src/lib`: Utility functions
- `src/integrations`: External service integrations
- `src/App.tsx`: Main application entry point with routing
- `src/main.tsx`: Application mount point
- `supabase/`: Supabase configuration
  - `functions/`: Edge Functions
  - `migrations/`: Database migrations
  - `config.toml`: Project configuration

## Key Dependencies

### Core

- `react`: ^18.3.1
- `react-dom`: ^18.3.1
- `react-router-dom`: ^6.30.1
- `@tanstack/react-query`: ^5.83.0

### UI Components

- `@radix-ui/*`: Various Radix UI primitives (accordion, dialog, dropdown-menu, etc.)
- `lucide-react`: ^0.462.0
- `recharts`: ^2.15.4

### Forms & Validation

- `react-hook-form`: ^7.67.0
- `@hookform/resolvers`: ^3.10.0
- `zod`: ^3.25.76

### Utilities

- `date-fns`: ^3.6.0
- `date-fns-tz`: ^3.2.0
- `clsx`: ^2.1.1
- `tailwind-merge`: ^2.6.0
- `papaparse`: ^5.5.3
- `react-imask`: ^7.6.1

### Backend Integration

- `@supabase/supabase-js`: ^2.86.0
- `@stripe/stripe-js`: ^3.5.0

### Notifications

- `sonner`: ^1.7.4
