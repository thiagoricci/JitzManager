# Jitz Manager

A comprehensive web-based management application designed for Brazilian Jiu-Jitsu (BJJ) academies. Streamline your academy operations with student management, attendance tracking, belt progression monitoring, membership management, integrated payment processing, student self-enrollment, waiver management, and staff management.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6)
![Vite](https://img.shields.io/badge/Vite-5.4.19-646CFF)

## 🥋 Features

### Core Functionality

- **Landing Page**: Public-facing marketing page for the platform
- **Onboarding**: Guided setup flow for new academy registrations
- **Dashboard**: Central hub displaying key metrics including total students, active attendance, belt promotions, and upcoming classes
- **Student Management**: Complete student directory with detailed profiles, contact information, belt tracking, and CSV import
- **Student Self-Enrollment**: Shareable signup links allowing students to enroll and pay online
- **Attendance Tracking**: Smart check-in system that automatically detects current classes based on schedule and time
- **Membership Management**: Comprehensive subscription handling with Stripe integration for payments
- **Class Scheduling**: Admin interface to set up and edit weekly class schedules
- **Belt Progression**: Visual tracking of student belt ranks (White → Blue → Purple → Brown → Black)
- **Waiver Management**: Digital liability waivers with e-signature capture and tracking

### Advanced Features

- **Multi-Tenant Architecture**: Strict data isolation between academies using Supabase Row Level Security
- **Payment Processing**: Full Stripe integration for membership subscriptions, one-time charges, and refunds
- **Student Import**: Bulk import students via CSV files
- **Payment History**: Complete transaction history for each student
- **Staff Management**: Invite and manage staff members with role-based access
- **Platform Administration**: Admin dashboard for platform owners to manage registered gyms
- **Custom Branding**: Customizable academy branding, logo uploads, and theme/appearance settings
- **Responsive Design**: Mobile-friendly interface for on-the-go management
- **Timezone Support**: Accurate date/time displays based on organization's timezone
- **Real-time Updates**: Live attendance tracking and status updates
- **Help Center & Documentation**: In-app help and documentation resources

## 🛠️ Tech Stack

### Frontend

- **Framework**: React 18.3.1 with TypeScript 5.8.3
- **Build Tool**: Vite 5.4.19
- **Styling**: Tailwind CSS 3.4.17
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Routing**: React Router DOM 6.30.1
- **State Management**: TanStack Query 5.83.0
- **Forms**: React Hook Form 7.67.0 with Zod validation
- **Charts**: Recharts 2.15.4
- **Icons**: Lucide React 0.462.0

### Backend & Database

- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Edge Functions**: Supabase Edge Functions (Deno runtime)
- **Payments**: Stripe

### Utilities

- **Date Handling**: date-fns 3.6.0 with date-fns-tz 3.2.0
- **CSV Parsing**: PapaParse 5.5.3
- **Input Masking**: react-imask 7.6.1
- **Notifications**: Sonner 1.7.4

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- **npm** (comes with Node.js) or alternative package manager (yarn, pnpm, bun)
- **Supabase CLI** - [Installation Guide](https://supabase.com/docs/guides/cli/getting-started)
- **Git** - [Download Git](https://git-scm.com/downloads)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/jitz-manager.git
cd jitz-manager
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory and add the following environment variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe Configuration (Optional - for local development)
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

To get your Supabase credentials:

1. Go to [supabase.com](https://supabase.com)
2. Create a new project or use an existing one
3. Navigate to Project Settings → API
4. Copy the Project URL and anon public API key

### 4. Database Setup

Apply the database migrations:

```bash
# Apply all migrations
supabase db push

# Or reset the database (WARNING: This deletes all data)
supabase db reset
```

### 5. Deploy Edge Functions

Deploy the Supabase Edge Functions:

```bash
# Deploy all functions
supabase functions deploy

# Deploy a specific function
supabase functions deploy stripe-webhook
```

### 6. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 📁 Project Structure

```
jitz-manager/
├── public/                      # Static assets
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── dashboard/          # Dashboard-specific chart components
│   │   ├── AccountSettingsCard.tsx
│   │   ├── ActivateStudentDialog.tsx
│   │   ├── AppearanceCard.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── BeltBadge.tsx
│   │   ├── ImportStudentsDialog.tsx
│   │   ├── Layout.tsx
│   │   ├── LogoUpload.tsx
│   │   ├── MembershipDialog.tsx
│   │   ├── NavLink.tsx
│   │   ├── PaymentHistory.tsx
│   │   ├── PaymentMethods.tsx
│   │   ├── PersonalInformationCard.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── ScrollToTop.tsx
│   │   ├── SignupLinkDialog.tsx
│   │   ├── StaffManagementCard.tsx
│   │   ├── StatCard.tsx
│   │   ├── StudentProfileCard.tsx
│   │   ├── WaiverBadge.tsx
│   │   └── WaiverSignForm.tsx
│   ├── contexts/                # React context providers
│   │   └── AuthContext.tsx
│   ├── data/                    # Static data and constants
│   ├── hooks/                   # Custom React hooks
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   └── usePlatformSubscription.ts
│   ├── integrations/            # External service integrations
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── types.ts
│   ├── lib/                     # Utility functions
│   │   ├── brand-theme.ts
│   │   ├── date.ts
│   │   ├── money.ts            # Typed money + billing-period helpers
│   │   ├── supabase.ts
│   │   ├── themes.ts
│   │   └── utils.ts
│   ├── pages/                   # Route components
│   │   ├── AddStudent.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminLogin.tsx
│   │   ├── Attendance.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Documentation.tsx
│   │   ├── EditStudent.tsx
│   │   ├── EnrollSuccess.tsx
│   │   ├── HelpCenter.tsx
│   │   ├── Index.tsx
│   │   ├── Join.tsx
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── MembershipDetail.tsx
│   │   ├── Memberships.tsx
│   │   ├── NotFound.tsx
│   │   ├── Onboarding.tsx
│   │   ├── PasswordRecovery.tsx
│   │   ├── PaymentCancelled.tsx
│   │   ├── PaymentSuccess.tsx
│   │   ├── Profile.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── Schedule.tsx
│   │   ├── Settings.tsx
│   │   ├── SignUp.tsx
│   │   ├── StripeConnectCallback.tsx
│   │   ├── StudentDetail.tsx
│   │   ├── Students.tsx
│   │   └── Waiver.tsx
│   ├── App.tsx                  # Main application with routing
│   ├── App.css                  # Application-specific styles
│   ├── main.tsx                 # Application entry point
│   └── index.css                # Global styles
├── supabase/
│   ├── functions/               # Edge Functions
│   │   ├── _shared/            # Shared utilities
│   │   ├── cancel-subscription/
│   │   ├── charge-student/
│   │   ├── complete-signup/
│   │   ├── complete-signup-enrollment/
│   │   ├── complete-stripe-connect/
│   │   ├── create-checkout-session/
│   │   ├── create-enrollment-checkout/
│   │   ├── create-platform-checkout-session/
│   │   ├── create-setup-session/
│   │   ├── create-staff/
│   │   ├── create-stripe-connect-link/
│   │   ├── delete-account/
│   │   ├── delete-payment-method/
│   │   ├── delete-staff/
│   │   ├── disconnect-stripe-account/
│   │   ├── exchange-stripe-code/
│   │   ├── get-enrollment-details/
│   │   ├── get-payment-methods/
│   │   ├── get-waiver/
│   │   ├── refund-payment/
│   │   ├── retry-payment/
│   │   ├── set-default-payment-method/
│   │   ├── sign-waiver/
│   │   ├── stripe-webhook/
│   │   ├── sync-membership-plan/
│   │   └── verify-payment-and-update-student/
│   ├── migrations/              # Database migrations
│   └── config.toml              # Supabase configuration
├── .env.local                   # Environment variables (not in git)
├── package.json                 # Project dependencies
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts              # Vite configuration
└── tailwind.config.ts          # Tailwind CSS configuration
```

## 🗄️ Database Schema

### Core Tables

#### `organizations`

Stores information about BJJ academies (tenants)

- `id`: UUID primary key
- `name`: Academy name
- `stripe_account_id`: Connected Stripe Express account ID
- `check_in_minutes_before`: Minutes before class start when check-in is allowed
- `check_in_minutes_after`: Minutes after class start when check-in is allowed
- `timezone`: Organization's timezone

#### `students`

Central table storing all student information

- `id`: UUID primary key
- `organization_id`: Foreign key to organizations
- `name`, `email`, `phone`: Contact information
- `address`, `city`, `state`, `zip_code`: Address details
- `join_date`: Date the student joined
- `belt`: Current belt rank (enum)
- `stripes`: Number of stripes (0-4)
- `status`: Student status (trial, active, inactive, frozen)
- `membership_status`: Membership status (active, inactive, frozen)
- `membership_plan_id`: Foreign key to membership_plans
- `stripe_customer_id`: Stripe Customer ID

#### `membership_plans`

Stores membership plan details

- `id`: UUID primary key
- `organization_id`: Foreign key to organizations
- `name`: Plan name
- `price`: Monthly price
- `stripe_price_id`: Stripe Price ID

#### `schedules`

Stores class schedule information

- `id`: UUID primary key
- `organization_id`: Foreign key to organizations
- `name`: Class name
- `day_of_week`: Day of week (0-6, Sunday-Saturday)
- `start_time`: Class start time
- `end_time`: Class end time

#### `attendance`

Stores student attendance records

- `id`: UUID primary key
- `organization_id`: Foreign key to organizations
- `student_id`: Foreign key to students
- `schedule_id`: Foreign key to schedules
- `date`: Date of attendance
- `created_at`: Check-in timestamp

#### `platform_subscriptions`

Manages gym subscriptions to the platform

- `id`: UUID primary key
- `organization_id`: Foreign key to organizations
- `stripe_subscription_id`: Stripe Subscription ID
- `stripe_customer_id`: Stripe Customer ID
- `status`: Subscription status
- `plan_id`: Subscription plan identifier

### Security

All tables implement Row Level Security (RLS) policies to ensure complete data isolation between organizations. Users can only access data belonging to their organization.

## 💳 Stripe Integration

### Setup

1. **Create Stripe Account**: Sign up at [stripe.com](https://stripe.com)
2. **Get API Keys**: Navigate to Developers → API keys
3. **Set Up Webhooks**: Create a webhook endpoint for your Supabase Edge Function URL
4. **Configure Products**: Create products and prices in Stripe Dashboard

### Edge Functions

The application uses Supabase Edge Functions for secure Stripe operations:

- **`stripe-webhook`**: Handles Stripe webhook events (payment.success, payment.failed, etc.)
- **`create-checkout-session`**: Creates Stripe checkout sessions for membership payments
- **`create-enrollment-checkout`**: Creates checkout sessions for student self-enrollment
- **`create-setup-session`**: Creates Stripe setup sessions for adding payment methods
- **`charge-student`**: Charges a student's saved payment method
- **`refund-payment`**: Refunds a previous payment
- **`retry-payment`**: Retries a failed payment
- **`delete-payment-method`**: Removes a saved payment method
- **`set-default-payment-method`**: Sets the default payment method
- **`get-payment-methods`**: Retrieves saved payment methods
- **`create-stripe-connect-link`**: Creates Stripe Connect onboarding links
- **`complete-stripe-connect`**: Handles Stripe Connect OAuth callback
- **`exchange-stripe-code`**: Exchanges Stripe authorization codes
- **`disconnect-stripe-account`**: Disconnects a Stripe account
- **`create-platform-checkout-session`**: Creates checkout for platform subscriptions
- **`cancel-subscription`**: Cancels a subscription
- **`verify-payment-and-update-student`**: Verifies payment and updates student status
- **`complete-signup`**: Completes user signup process
- **`complete-signup-enrollment`**: Completes signup for self-enrolled students
- **`create-staff`**: Creates staff member accounts
- **`delete-staff`**: Removes staff member access
- **`get-enrollment-details`**: Retrieves enrollment details for a signup link
- **`get-waiver`**: Retrieves waiver details
- **`sign-waiver`**: Records a signed digital waiver
- **`sync-membership-plan`**: Syncs membership plans with Stripe
- **`delete-account`**: Handles account deletion requests

## 🎨 UI Components

The application uses [shadcn/ui](https://ui.shadcn.com/) for UI components. To add new components:

```bash
npx shadcn@latest add [component-name]
```

Available components include: button, input, card, dialog, dropdown-menu, select, table, badge, alert, and many more.

## 📝 Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Build for development
npm run build:dev

# Run linter
npm run lint

# Preview production build
npm run preview
```

## 🔧 Development

### Adding a New Page

1. Create a new component in `src/pages/`
2. Add the route in `src/App.tsx`
3. Wrap with `<ProtectedRoute>` and `<Layout>` if authentication is required
4. Add navigation link in `src/components/AppSidebar.tsx` if needed

### Creating a Database Migration

```bash
# Create a new migration
supabase migration new migration_name

# Apply migrations
supabase db push

# Reset database (WARNING: Deletes all data)
supabase db reset
```

### Adding a New Edge Function

1. Create a new directory in `supabase/functions/`
2. Create an `index.ts` file with your function logic
3. Deploy the function:
   ```bash
   supabase functions deploy function-name
   ```

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Netlify

1. Push your code to GitHub
2. Import your repository in [Netlify](https://netlify.com)
3. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add environment variables
5. Deploy!

### Other Platforms

This is a standard Vite + React application and can be deployed to any platform that supports static sites, including:

- GitHub Pages
- AWS Amplify
- Cloudflare Pages
- Firebase Hosting

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and conventions
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Supabase](https://supabase.com/) for the backend infrastructure
- [Stripe](https://stripe.com/) for payment processing
- [Vite](https://vitejs.dev/) for the build tool
- All contributors and users of this project

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/jitz-manager/issues) page
2. Create a new issue with detailed information
3. Join our community discussions

## 🗺️ Roadmap

- [ ] Mobile app for instructors
- [ ] Advanced analytics and reporting
- [ ] Belt promotion workflows
- [ ] Inventory management for gear
- [ ] Event and competition management
- [ ] Integration with popular calendar apps
- [ ] Multi-language support

---

Made with ❤️ for the BJJ community
