# AutoServe — AI-Powered Automotive Service Management

Production-grade, three-portal automotive workshop platform tailored for the **Indian market** (₹ INR pricing, Maruti/Tata/Mahindra fleet, Gurugram operations).

Built on **React 18 + Vite + TypeScript + Tailwind**, backed by **Supabase** (Postgres, Auth, RLS, Realtime, Edge Functions) and **Lovable AI Gateway** (Gemini 2.5 Flash).

---

## Prerequisites

- [Node.js](https://nodejs.org/) **v18 or higher**
- [npm](https://www.npmjs.com/) (comes with Node.js)
- Git

---

## Installation & Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/anupp29/autoserve2.git
cd autoserve2
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root with the following values:

```env
VITE_SUPABASE_URL=""
VITE_SUPABASE_PUBLISHABLE_KEY=""
VITE_SUPABASE_PROJECT_ID=""
```

> These values are already present in the `.env` file if you cloned the repo. No further changes are needed for local development.

### 4. Start the development server

```bash
npm run dev
```

The app is now running at **http://localhost:8080**

### 5. Open the app

Go to [http://localhost:8080](http://localhost:8080) in your browser. You will be greeted with the AutoServe sign-in page.

---

## Demo Accounts

Use these pre-seeded accounts to explore all three portals:

| Role | Email | Password |
|---|---|---|
| Manager | `manager@autoserve.in` | `autoserve@123` |
| Employee | `employee@autoserve.in` | `autoserve@123` |
| Customer | `customer@autoserve.in` | `autoserve@123` |

---

## End-to-End Workflow

### As a Customer

1. Sign in with `customer@autoserve.in` / `autoserve@123`
2. Go to **My Vehicles** → Add a vehicle (make, model, year, registration)
3. Go to **Book a Service** → Select your vehicle → Choose one or more services → Set priority (Normal / Express / Priority) → Confirm booking
4. Go to **My Bookings** to view the booking status and QR drop-off code
5. Use the **AI Assistant** (chat) to ask questions about your vehicle or services
6. Use **AI Diagnostics** to describe symptoms and get service recommendations
7. Use **AI Resale Valuation** to get a market estimate for your vehicle

### As an Employee (Technician)

1. Sign in with `employee@autoserve.in` / `autoserve@123`
2. Go to **Job Queue** to see bookings assigned to you
3. Open a booking → Click **Check In** → Update status through `in_progress → ready_for_pickup → completed`
4. Go to **QR Scanner** (`/staff/scan`) → Scan customer QR codes for drop-off and pick-up
5. Use **AI Vehicle Summary** to get a one-click brief of a vehicle's service history
6. Go to **Inventory** to view parts stock and reorder levels

### As a Manager

1. Sign in with `manager@autoserve.in` / `autoserve@123`
2. Go to **Bookings** → View all bookings, assign them to technicians, update statuses
3. Go to **Services** → Add, edit, or remove services from the catalogue (name, category, price, duration)
4. Go to **Inventory** → Track parts stock, update quantities, set reorder thresholds
5. Go to **Reports** → View revenue, booking counts, and technician performance
6. Go to **Create Employee** → Provision a new technician account (uses the `admin-create-employee` edge function)

---

## Other Commands

```bash
npm run build       # Production build (outputs to dist/)
npm run preview     # Preview the production build locally
npm test            # Run all unit tests (vitest)
npm run lint        # Run ESLint
```

---

## Running Tests

```bash
npm test
```

This runs 35 unit tests across:

- `src/lib/format.test.ts` — currency formatting, dates, time-ago, initials
- `src/lib/recommendations.test.ts` — related-service suggestions, priority pricing
- `src/lib/brandLogos.test.ts` — Indian car brand logo resolution
- `src/lib/bookingLifecycle.test.ts` — status classification, total-cost math

All 35 tests pass. See [`TEST_CASES.md`](./TEST_CASES.md) for the full test matrix.

---

## Project Structure

```
autoserve2/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route-level pages (manager, employee, customer)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and business logic
│   └── integrations/     # Supabase client and types
├── supabase/
│   ├── functions/        # Deno Edge Functions
│   └── migrations/       # Database migrations (SQL)
├── public/               # Static assets
├── index.html
├── vite.config.ts
└── package.json
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React SPA (Vite · http://localhost:8080)                    │
│  ├ /manager/*    Bookings · Services · Inventory · Reports    │
│  ├ /employee/*   Queue · Job · Inventory · Performance        │
│  ├ /customer/*   Vehicles · Book · Bookings · AI Assistant    │
│  └ /staff/scan   Shared QR drop-off / pick-up scanner         │
└──────────────────────────────────────────────────────────────┘
                          │ supabase-js
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase  (Postgres + Auth + Realtime + Edge Functions)     │
│  ├ tables       profiles · user_roles · vehicles · services   │
│  │              bookings · service_history · inventory        │
│  │              service_reminders · notifications             │
│  ├ triggers     gen_booking_codes · create_history_on_completion │
│  └ RLS          per-table, role-aware via has_role()          │
└──────────────────────────────────────────────────────────────┘
                          │ supabase.functions.invoke
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Edge Functions  (Deno)                                       │
│  ├ admin-create-employee     manager-only staff provisioning  │
│  ├ ai-maintenance-tips       per-vehicle AI tips              │
│  ├ ai-diagnostics            symptom triage + chat mode       │
│  ├ ai-vehicle-summary        technician brief                 │
│  ├ ai-resale-valuation       Indian used-car valuation        │
│  └ seed-demo-accounts        seeds the 3 demo accounts        │
└──────────────────────────────────────────────────────────────┘
                          │ HTTPS
                          ▼
                   Lovable AI Gateway
                   (Google Gemini 2.5 Flash)
```

---

## Booking Lifecycle

```
pending → confirmed → checked_in → in_progress → ready_for_pickup → completed → released
```

Each transition is triggered manually by the assigned technician or manager. A database trigger automatically creates a `service_history` record when a booking reaches `completed` or `released`.

---

## Key Features

| Feature | Description |
|---|---|
| 3 role-based portals | Manager, Employee, Customer — separate dashboards and permissions |
| QR drop-off / pick-up | Auto-generated codes per booking; scanner at `/staff/scan` |
| AI Assistant | Customer chat grounded in their own vehicles and service catalogue |
| AI Diagnostics | Symptom → probable cause → recommended service |
| AI Maintenance Tips | Per-vehicle recommendations |
| AI Vehicle History Summary | One-click brief for technicians |
| AI Resale Valuation | Indian used-car market estimate |
| Multi-service bookings | Select multiple services with priority surcharges (+15% Express, +30% Priority) |
| Realtime updates | All changes propagate instantly via Supabase Realtime |
| Manager staff provisioning | Managers create employee accounts via edge function |
