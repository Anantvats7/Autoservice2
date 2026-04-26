# AutoServe — Complete Project Overview

## What Is This App?

AutoServe is a full-stack, AI-powered car workshop management platform built for the Indian market. It manages the entire lifecycle of a vehicle service — from a customer booking online, to a technician completing the job, to a manager reviewing revenue reports.

It has three separate portals (dashboards) for three types of users:
- **Customer** — books services, tracks vehicles, uses AI features
- **Employee/Technician** — manages their job queue, updates booking status, scans QR codes
- **Manager** — oversees all bookings, staff, inventory, services, and reports

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui components |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) |
| AI | Google Gemini API (gemini-2.5-flash-lite, gemini-2.0-flash-lite) |
| Deployment | Vercel (frontend) + Supabase (backend) |
| CI/CD | GitHub Actions |

---

## How Everything Is Connected

```
Browser (React SPA on Vercel)
        │
        │  supabase-js client (HTTPS)
        │
        ▼
Supabase Project (vlktrhfqjsbnmomrwthj)
        │
        ├── PostgreSQL Database
        │       └── 9 tables with RLS policies
        │
        ├── Supabase Auth
        │       └── JWT tokens, email/password login
        │
        ├── Supabase Realtime
        │       └── Live updates pushed to browser on any DB change
        │
        └── Edge Functions (Deno runtime)
                └── 6 functions that call Gemini AI API
                        │
                        ▼
                Google Gemini API
                (generativelanguage.googleapis.com)
```

---

## Supabase — Detailed Breakdown

### Authentication

Supabase Auth handles all login/signup. When a user signs up:
1. Supabase creates a record in `auth.users` (internal table)
2. A database trigger `on_auth_user_created` fires automatically
3. It creates a row in `public.profiles` (name, phone)
4. It creates a row in `public.user_roles` with role = `customer` by default

Managers create employee accounts via the `admin-create-employee` edge function, which uses the Supabase Admin API to create users with the `employee` role.

### Database Tables

#### `profiles`
Stores display information for every user.
- `user_id` → links to `auth.users`
- `full_name`, `phone`, `avatar_url`
- Auto-created by trigger on signup

#### `user_roles`
Stores what role each user has: `manager`, `employee`, or `customer`.
- One user can only have one role
- Used by RLS policies to control data access
- The `has_role(user_id, role)` SQL function checks this table

#### `vehicles`
Customer-owned vehicles.
- `owner_id` → links to `auth.users`
- `make`, `model`, `year`, `registration`, `color`, `mileage`, `fuel_type`
- Registration must be unique across all vehicles

#### `services`
The workshop's service catalogue (what they offer).
- `name`, `category`, `description`, `price`, `duration_minutes`
- `active` flag — inactive services are hidden from customers
- Managed by managers only

#### `bookings`
The core table — every service appointment.
- `customer_id` → who booked it
- `vehicle_id` → which car
- `service_id` → which service
- `assigned_to` → which technician (nullable)
- `status` → see booking lifecycle below
- `priority` → `normal`, `express` (+15%), `priority` (+30%)
- `dropoff_code` → auto-generated `DROP-XXXXXXXX` code for QR
- `pickup_code` → auto-generated `PICK-XXXXXXXX` code for QR
- `extra_service_ids` → array of additional service IDs
- `total_cost` → final price including priority surcharge

#### `service_history`
Permanent record of completed services.
- Auto-created by DB trigger when booking reaches `completed` or `released`
- `booking_id` → links back to the booking
- `mileage_at_service`, `parts_used`, `notes` → filled by technician
- `cost` → what was charged

#### `inventory`
Workshop parts and supplies stock.
- `sku` → unique part identifier
- `quantity`, `reorder_level` → when quantity < reorder_level, it shows as low stock
- `unit_price`, `supplier`

#### `notifications`
In-app notifications for all users.
- Auto-created by DB triggers when:
  - A new booking is created → managers get notified
  - A new customer registers → managers get notified
  - Booking status changes → customer gets notified

#### `service_reminders`
Upcoming maintenance reminders for customers.
- `due_date`, `title`, `message`
- `acknowledged` → customer can dismiss them
- Currently seeded manually, not yet auto-generated

### Database Triggers

| Trigger | Table | When | What it does |
|---------|-------|------|-------------|
| `on_auth_user_created` | `auth.users` | New user signup | Creates `profiles` and `user_roles` rows |
| `bookings_codes_trg` | `bookings` | New booking inserted | Generates `dropoff_code` and `pickup_code` |
| `trg_create_history_on_completion` | `bookings` | Status → `completed` or `released` | Creates `service_history` row |
| `trg_notify_managers_new_booking` | `bookings` | New booking inserted | Notifies all managers |
| `trg_notify_managers_new_customer` | `profiles` | New profile created | Notifies managers if role is customer |
| `bookings_updated_at` | `bookings` | Any update | Updates `updated_at` timestamp |

### Row Level Security (RLS)

Every table has RLS enabled. Users can only see/edit data they're allowed to.

The key function is `has_role(user_id, role)` — it checks the `user_roles` table and is used in every policy.

| Table | Customer can | Employee can | Manager can |
|-------|-------------|-------------|-------------|
| `profiles` | Read/edit own | Read all | Read/edit all |
| `vehicles` | CRUD own | Read all | CRUD all |
| `bookings` | Read/create own, cancel own | Read all, update assigned | Full CRUD |
| `services` | Read active | Read all | Full CRUD |
| `inventory` | None | Read, update quantity | Full CRUD |
| `service_history` | Read own | Read all | Full CRUD |
| `notifications` | Read/update own | Read own | Read own |

### Realtime

All 9 tables are added to `supabase_realtime` publication. The frontend uses a custom hook `useLiveTable` that:
1. Fetches data on mount
2. Subscribes to `postgres_changes` events on the table
3. Refetches whenever any change happens

This means when a manager updates a booking status, the customer's screen updates instantly without refreshing.

---

## Edge Functions — Detailed Breakdown

All edge functions run on Deno (not Node.js). They are deployed to Supabase and called from the frontend using `supabase.functions.invoke()`.

### `ai-diagnostics`

**Two modes:**

**Mode 1: `diagnose`**
- Input: vehicle info + symptom description + service catalogue
- Output: list of probable faults with confidence %, recommended service IDs, pro tip
- Used by: Customer → AI Diagnostics page

**Mode 2: `chat`**
- Input: conversation history + full customer context (vehicles, services, recent bookings)
- Output: AI reply + optional `booking_intent` object
- Used by: Customer → AI Assistant page AND Manager → Reports page (AI Insights)
- Smart detection: if context has no vehicles/services → switches to business analyst mode for managers

### `ai-maintenance-tips`
- Input: vehicle make/model/year/mileage/fuel_type + service catalogue
- Output: 3 maintenance tips + recommended service names
- Used by: Customer Dashboard (auto-loads for first vehicle)

### `ai-resale-valuation`
- Input: vehicle details + condition (Fair/Good/Excellent)
- Output: estimated value, base value, trend %, confidence score, insights, warnings, depreciation chart data
- Used by: Customer → Resale Value Predictor page

### `ai-vehicle-summary`
- Input: vehicle details + full service history
- Output: plain-text technician briefing (4-6 lines)
- Used by: Employee → Job Detail page (Generate button)

### `admin-create-employee`
- Input: name, email, phone (from manager)
- Auth check: verifies caller is a manager via JWT
- Creates a new Supabase Auth user with `employee` role
- Used by: Manager → Employees page

### `seed-demo-accounts`
- Creates/updates 3 demo accounts (manager, employee, customer)
- Seeds 12 services, 10 inventory items, 3 vehicles, 4 bookings, 4 history records, notifications
- Called once after deployment to populate demo data

### AI Model Fallback Chain

All AI functions try models in this order:
1. `gemini-2.5-flash-lite` — primary, fastest, most quota-efficient
2. `gemini-2.0-flash-lite` — fallback if primary is rate-limited

Each model gets 2 retries with exponential backoff + jitter before moving to the next:
- Attempt 1: wait ~1s
- Attempt 2: wait ~2s
- Max wait: 8s per attempt

---

## Frontend — Detailed Breakdown

### Authentication Flow

```
User visits app
      ↓
AuthProvider (useAuth hook) checks Supabase session
      ↓
If logged in → fetch profile + role from DB
      ↓
ProtectedRoute checks role matches the route
      ↓
RoleLayout renders the correct sidebar/nav for that role
      ↓
User sees their dashboard
```

### Route Structure

```
/                          → Landing page
/login                     → Login page

/manager/dashboard         → KPIs, recent bookings, low stock alerts
/manager/bookings          → All bookings, assign technicians, update status
/manager/history           → All completed service records
/manager/services          → Add/edit/delete services catalogue
/manager/inventory         → Stock levels, update quantities
/manager/employees         → Staff list, create new employee
/manager/customers         → Customer list with vehicle counts
/manager/reports           → Revenue charts, AI business insights
/manager/scan              → QR scanner (shared with employee)

/employee/dashboard        → Today's jobs, performance stats
/employee/queue            → All assigned bookings
/employee/job/:id          → Individual job detail, status updates, AI summary
/employee/inventory        → Read-only inventory view
/employee/performance      → Personal stats
/employee/scan             → QR scanner

/customer/dashboard        → Vehicles, next booking, AI tips, history
/customer/vehicles         → Add/edit vehicles
/customer/book             → Book a service
/customer/bookings         → All bookings with QR codes
/customer/history          → Past service records
/customer/diagnostics      → AI symptom analysis
/customer/valuation        → AI resale value predictor
/customer/assistant        → AI chat with booking capability

/staff/scan                → QR drop-off/pickup scanner (accessible by both roles)
```

### Key Custom Hooks

**`useLiveTable`** — the most important hook in the app
- Generic hook used everywhere to fetch and subscribe to any Supabase table
- Takes a table name, a query builder function, and dependency array
- Automatically refetches when realtime events fire
- Returns `{ data, loading, error, refetch }`

**`useAuth`** — authentication context
- Wraps Supabase auth session
- Provides `user`, `profile`, `role`, `loading`
- Used by every protected page

**`useStaff`** — fetches all profiles grouped by role
- Used by manager pages to show employee/customer names

---

## Booking Lifecycle

```
pending
   ↓ (manager/employee confirms)
confirmed
   ↓ (QR scan at drop-off OR employee checks in)
checked_in
   ↓ (employee starts work)
in_progress
   ↓ (employee finishes)
ready_for_pickup
   ↓ (manager/employee marks complete)
completed
   ↓ (QR scan at pickup OR employee releases)
released
```

At `completed` or `released` → DB trigger auto-creates `service_history` record.

Can also go to `cancelled` from `pending` or `confirmed`.

---

## QR Code System

Every booking gets two auto-generated codes when created (via DB trigger):
- `DROP-XXXXXXXX` — used at vehicle drop-off
- `PICK-XXXXXXXX` — used at vehicle pickup

The `/staff/scan` page lets employees/managers type or scan these codes to advance the booking status automatically.

---

## AI Chat — How It Works

```
Customer types message
        ↓
Frontend builds "context" object:
  - customer name
  - all their vehicles (with active vehicle flagged)
  - full services catalogue with IDs and prices
  - last 8 bookings
  - today's and tomorrow's date (IST)
        ↓
Sends to ai-diagnostics edge function (chat mode)
        ↓
Edge function builds system prompt with all context
        ↓
Calls Gemini API
        ↓
Gemini returns JSON: { reply, booking_intent? }
        ↓
If booking_intent present AND last message had booking keywords:
  → Show BookingCard UI (Confirm / Cancel)
  → On confirm: insert into bookings table
        ↓
If no booking_intent:
  → Show plain text reply
```

The AI knows:
- Which vehicle is "active" (selected in the picker)
- All service IDs and prices
- Recent booking history
- Today's exact date in IST

---

## Deployment

### Infrastructure

| Service | What it hosts |
|---------|--------------|
| Vercel | React frontend (auto-deploys on git push) |
| Supabase | Database, Auth, Realtime, Edge Functions |
| GitHub Actions | Deploys edge functions + sets secrets on push |

### Environment Variables

**Vercel (frontend):**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key (safe to expose)

**Supabase Secrets (edge functions):**
- `GEMINI_API_KEY` — Google Gemini API key

**GitHub Secrets (CI/CD):**
- `SUPABASE_ACCESS_TOKEN` — for CLI authentication
- `SUPABASE_PROJECT_ID` — `vlktrhfqjsbnmomrwthj`
- `SUPABASE_ANON_KEY` — for seeding demo data
- `GEMINI_API_KEY` — set into Supabase secrets via workflow

### Deployment Flow

```
Developer pushes to GitHub main branch
        ↓
GitHub Actions workflow runs:
  1. Installs Supabase CLI
  2. Deploys all edge functions
  3. Sets GEMINI_API_KEY in Supabase secrets
  4. Calls seed-demo-accounts function
        ↓
Vercel detects push → builds React app → deploys to CDN
```

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@autoserve.in | autoserve@123 |
| Employee | employee@autoserve.in | autoserve@123 |
| Customer | customer@autoserve.in | autoserve@123 |

Demo customer has:
- 3 vehicles: Maruti Swift VXi, Tata Nexon EV, Mahindra XUV700
- 4 bookings in various states
- 4 service history records
- 3 notifications

---

## Common Questions

**Q: How does role-based access work?**
A: When a user logs in, the app fetches their role from `user_roles` table. `ProtectedRoute` checks if the user's role matches the route. RLS policies in Supabase enforce the same rules on the database level — so even if someone bypasses the frontend, they can't read data they shouldn't.

**Q: How are QR codes generated?**
A: A PostgreSQL trigger `bookings_codes_trg` fires on every new booking insert. It generates two random codes (`DROP-XXXXXXXX` and `PICK-XXXXXXXX`) using `gen_random_uuid()` and stores them in the booking row.

**Q: How does the AI know about the customer's vehicles?**
A: The frontend builds a context object with all the customer's vehicles, services, and recent bookings, then sends it with every chat message. The edge function injects this into the Gemini system prompt so the AI has full context.

**Q: What happens when a booking is completed?**
A: A PostgreSQL trigger `trg_create_history_on_completion` fires when booking status changes to `completed` or `released`. It automatically inserts a row into `service_history` with the booking details, cost, and technician.

**Q: How does realtime work?**
A: All tables are added to Supabase's realtime publication. The frontend subscribes to `postgres_changes` events. When any row changes in the database, Supabase pushes the event to all subscribed clients, and the `useLiveTable` hook refetches the data.

**Q: What is the priority surcharge?**
A: Normal = base price. Express = +15%. Priority = +30%. The surcharge is calculated in the frontend when displaying prices and when creating bookings.

**Q: How are employees created?**
A: Only managers can create employees. They fill a form in the Employees page, which calls the `admin-create-employee` edge function. The function verifies the caller is a manager (via JWT), then uses the Supabase Admin API to create the user with the `employee` role.

**Q: What is the Supabase project ID?**
A: `vlktrhfqjsbnmomrwthj`

**Q: What AI model is used?**
A: Google Gemini. Primary: `gemini-2.5-flash-lite`. Fallback: `gemini-2.0-flash-lite`. The fallback activates automatically if the primary model is rate-limited, with exponential backoff and jitter between retries.
