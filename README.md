# Service Mobility Dashboard

Service Mobility Dashboard is a full-stack web application for field-service dispatchers. It provides a daily geographic view of service tasks, optimized vehicle routes, and decision-support recommendations for assigning new service requests.

The dashboard is designed as a source-system-agnostic operational layer. It works with normalized service-task data stored in Supabase and can be integrated with an existing ERP, organizational database, or other operational source system.

The original business need arose in an SAP-based environment, but the application itself is not dependent on SAP.

The application is built with Next.js, TypeScript, Supabase, Mapbox, and Google Places. The organization's upstream ERP or operational source system remains the authoritative source of truth, while the dashboard consumes a read-only normalized mirror in Supabase.

## 🚀 Demo Mode

For evaluation and demonstration, the application includes a Demo Mode with a predefined week containing sample operational data.

Recommended demo period:

```text
01/09/2026 - 07/09/2026
```

Use the **Demo** button on the main dashboard to load the demonstration week and review the main product flows with populated data.

The demo data uses the same normalized service-task model as the application and is independent of any specific ERP provider.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Supabase / PostgreSQL
- Supabase Auth
- Mapbox GL + Mapbox Optimization API
- Google Places API
- Vitest
- Playwright

## Local Development Setup

### 1. Prerequisites

Before running the project, make sure you have:

- Git
- Node.js and npm
- Access to the shared Supabase project
- A Mapbox public token
- A Google Maps / Places API key configured for the project

### 2. Clone the repository

```bash
git clone https://github.com/adigreiman1/fullstack_final_project.git
cd fullstack_final_project
```

If the project is already cloned, update it first:

```bash
git pull
```

### 3. Install dependencies

```bash
npm install
```

Install the browser binaries required by Playwright:

```bash
npx playwright install
```

### 4. Configure environment variables

Create a `.env.local` file in the project root, next to `package.json`:

```bash
touch .env.local
```

Add the following application variables:

```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_MAPBOX_TOKEN=<your-mapbox-public-token>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>
```

Do not commit `.env.local` to Git. The project `.gitignore` excludes `.env*` files.

The required environment-variable values and authorized test-user credentials are provided separately to the course staff and are not stored in the repository.

### 5. Run the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port 3000 is already in use, stop the existing process or use the alternate port reported by Next.js.

### 6. Sign in

The dashboard is available only to authorized Supabase Auth users.

Use an existing dispatcher account created for the shared project.

Public self-registration is not part of the application.

## Available Commands

Run the development server:

```bash
npm run dev
```

Run lint checks:

```bash
npm run lint
```

Run unit tests with Vitest:

```bash
npm test
```

Run unit tests in watch mode:

```bash
npm run test:watch
```

Run End-to-End tests with Playwright:

```bash
npm run test:e2e
```

Create a production build:

```bash
npm run build
```

Run the production build locally:

```bash
npm start
```

## End-to-End Test Environment

The Playwright flows require a valid dispatcher account and controlled test data in the shared Supabase environment.

Add the following variables to `.env.local` when running E2E tests:

```env
E2E_DISPATCHER_EMAIL=<test-dispatcher-email>
E2E_DISPATCHER_PASSWORD=<test-dispatcher-password>
E2E_SEARCH_ADDRESS=דיזנגוף 10, תל אביב
```

Do not commit the dispatcher email or password to Git.

### Prepare the E2E test data

Before running the E2E suite, open the Supabase SQL Editor and execute:

```text
supabase/seed-e2e.sql
```

The script removes the previous dedicated recommendation fixture and creates a fresh test task for the following day.

This keeps the recommendation test deterministic while preserving the application's real four-day recommendation logic.

The fixture is test setup data only. It is not an application migration and does not change the read-only permissions available to normal application users.

After preparing the fixture, run:

```bash
npm run test:e2e
```

## Database Notes

- `service_tasks` is a read-only mirror of operational data originating from an upstream ERP, organizational database, or other operational source system.
- The upstream operational system remains the authoritative source of truth.
- Row Level Security is enabled.
- Anonymous users cannot read operational task data.
- Authenticated application users can read the shared operational dataset.
- Normal application roles cannot insert, update, delete, or truncate service-task records.
- Synchronization with the upstream source system is outside the scope of the current application.

## Final Submission Documents

The final project documentation is available in:

```text
Final_Submission_Documents/
```

The folder contains:

- `Product_Specification.pdf`
- `Technical_Design.pdf`
- `Test_Specification.pdf`
- `Basic_Scale.pdf`
- `Basic_Security.pdf`
- `Local_Setup_Instructions.pdf`

## Troubleshooting

### Missing environment variable

If startup fails with a message such as:

```text
Missing environment variable NEXT_PUBLIC_SUPABASE_URL
```

verify that `.env.local` exists in the project root, contains the required value, and restart:

```bash
npm run dev
```

### Port 3000 is already in use

A previous Next.js development server may still be running.

You can either use the existing server at:

```text
http://localhost:3000
```

or stop that process and run:

```bash
npm run dev
```

again.

### Address search does not work locally

Verify that `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is valid, that the required Google Places API is enabled, and that the key's application restrictions allow local development if restrictions are configured.

### Map or routes do not load

Verify that `NEXT_PUBLIC_MAPBOX_TOKEN` is present and valid.

### End-to-End recommendation test has no results

Run:

```text
supabase/seed-e2e.sql
```

again in the Supabase SQL Editor before executing:

```bash
npm run test:e2e
```

The script refreshes the dedicated recommendation fixture relative to the current date.

## Deployment

The application is deployed on Vercel with the required environment variables configured in the Vercel project settings.

Production application:

https://fullstack-final-project-chi.vercel.app/

GitHub repository:

https://github.com/adigreiman1/fullstack_final_project.git