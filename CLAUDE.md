@AGENTS.md

# BudgetBliss — Project Rules for Claude Code

## What this app is
A self-hosted personal finance receipt tracker. Single admin user, no public registration.
Receipts are uploaded as images, analyzed by Claude API, and stored with full line-item data.

---

## Architecture

- **Framework**: Next.js 16 App Router (`src/app/`)
- **Routing**: All protected pages live under `src/app/(protected)/`; auth pages under `src/app/(auth)/`
- **Default**: Server Components — only add `'use client'` when browser APIs or React hooks are required
- **DB access**: Only in Server Components, Server Actions, or API route handlers (`src/app/api/`)
- **API routes**: Next.js Route Handlers in `src/app/api/**` — never Pages API routes
- **Types**: Define in `src/types/` — reuse across files, no inline type definitions in components

---

## Critical Conventions

### Money — ALWAYS store as integer cents
```typescript
// Storage (cents): $12.50 → 1250
const cents = Math.round(parseFloat(rawValue) * 100);

// Display (dollars): 1250 → "$12.50"
// Use src/lib/utils/currency.ts helpers — NEVER do this inline
import { fromCents, toCents } from "@/lib/utils/currency";
```
**Never store floats for money in MongoDB. Convert only at the API boundary.**

### Zod validation — validate ALL inputs
Every API route handler must validate request body/params with a Zod schema before any logic:
```typescript
const body = BodySchema.parse(await req.json()); // throws ZodError on failure
```

### API error responses — typed, never expose internals
```typescript
// Always return this shape:
{ error: string; code: string; details?: Record<string, string[]> }
// Never: { error: err.message } — raw errors leak internals
```

### Logger — use structured logging
```typescript
import { logger } from "@/lib/logger";
logger.error({ context: "POST /api/receipts/upload", step: "save-to-disk" }, "Failed to write file");
// Never use console.log in server code
```

### Environment variables — centralized config only
```typescript
// WRONG: process.env.ANTHROPIC_API_KEY directly in a component or lib
// CORRECT: import from src/lib/config.ts
import { env } from "@/lib/config";
```

---

## File Naming

| Type | Convention | Example |
|---|---|---|
| React components | PascalCase | `ReceiptCard.tsx` |
| Hooks | camelCase with `use` prefix | `useReceipts.ts` |
| Utilities / lib | camelCase | `currency.ts` |
| Route handlers | `route.ts` | `route.ts` |
| Types | camelCase | `receipt.ts` |

---

## Styling

- Use **Tailwind CSS** utility classes
- Use **shadcn/ui** components from `src/components/ui/` — don't re-implement buttons, inputs, dialogs
- Use **semantic color tokens** (`text-foreground`, `bg-background`, `border-border`) — never hardcode colors like `text-gray-700` for themed elements
- No inline styles except for truly dynamic values (e.g., chart colors computed at runtime)

---

## Testing Standards

- Every new utility in `src/lib/` must have a corresponding test in `src/__tests__/lib/`
- Every API route must have integration tests in `src/__tests__/api/`
- Tests use `mongodb-memory-server` — never a real DB connection
- Mock external APIs (`@anthropic-ai/sdk`, `sharp`) in all tests
- Run `npm test` before marking any task complete

---

## Security Rules

1. **File uploads**: Validate MIME type AND file magic bytes — not just extension
2. **No raw errors to client**: Catch all errors, log server-side, return typed `ApiError`
3. **No secrets in logs**: Never log API keys, passwords, or full tokens
4. **Auth on all routes**: Every API route must call `auth()` from NextAuth and return 401 if no session
5. **Sanitize DB queries**: Use Mongoose — never raw string interpolation in queries

---

## API Route Template

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";

const BodySchema = z.object({
  // define fields here
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();
    const body = BodySchema.parse(await req.json());
    // ... logic
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ context: "POST /api/...", error: err }, "Unexpected error");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```
