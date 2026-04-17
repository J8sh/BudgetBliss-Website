# BudgetBliss

A self-hosted personal finance receipt tracker. Upload receipt images and let Claude AI extract the line-item data automatically, or enter receipts manually. All data stays on your own infrastructure.

## Features

- **AI receipt extraction** — upload a photo and Claude parses store name, date, line items, totals, and payment method
- **Dashboard** — spending overview with daily trend chart, top stores breakdown, and quick stats (today / week / month / year)
- **Receipt management** — search, filter by date range and payment method, sort, and paginate all receipts
- **Duplicate detection** — image hash + metadata comparison prevents double-counting
- **Spending history** — date-filtered aggregated reports
- **Single admin user** — no public registration; credentials set via seed script
- **Dark mode** — system, light, or dark theme preference persisted per user

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | MongoDB + Mongoose |
| Auth | NextAuth.js v5 (Credentials) |
| AI | Anthropic Claude API |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Image processing | Sharp |
| Logging | Pino |
| Testing | Jest + mongodb-memory-server |

## Prerequisites

- Node.js 20+
- MongoDB instance (local or Atlas)
- Anthropic API key

## Environment Variables

Create a `.env` file at the project root:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/budgetbliss

# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Admin seed credentials (used by the seed script)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-password
```

## Getting Started

```bash
# Install dependencies
npm install

# Seed the admin user
npx tsx src/lib/db/seed.ts

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your admin credentials.

## Docker

```bash
# Build and start all services (app + MongoDB)
docker-compose up --build

# Run in the background
docker-compose up -d
```

The compose file starts MongoDB on port 27017 and the Next.js app on port 3000.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Create production build |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/        # Login page
│   ├── (protected)/         # Auth-gated pages (dashboard, receipts, upload, history, settings, admin)
│   └── api/                 # Route handlers (receipts, stats, user, auth, health)
├── components/
│   ├── dashboard/           # Stat cards, charts, homepage layout
│   ├── receipts/            # Receipt table, detail view, form
│   ├── upload/              # File upload zone, camera capture
│   ├── layout/              # AppShell, Sidebar, Navbar, ThemeProvider
│   └── ui/                  # shadcn/ui primitives
├── hooks/                   # useStats, useDashboardLayout
├── lib/
│   ├── api/claude.ts        # Claude receipt extraction
│   ├── auth/auth.ts         # NextAuth configuration
│   ├── db/mongoose.ts       # MongoDB connection singleton
│   ├── image/               # Sharp optimization + SHA-256 hashing
│   ├── models/              # Mongoose models (Receipt, User)
│   └── utils/               # Currency helpers, date boundaries, Zod validators
└── types/                   # Shared TypeScript types
```

## Money Handling

All monetary amounts are stored as **integer cents** in MongoDB and converted only at display time using helpers in `src/lib/utils/currency.ts`. Never store floats for money.

## Rate Limiting

Receipt uploads are rate-limited to **20 requests per 10 minutes** per IP using a token bucket algorithm (`src/lib/rateLimit.ts`).
