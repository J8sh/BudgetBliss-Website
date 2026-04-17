---
description: BudgetBliss coding standards — enforce when writing or reviewing any code in this project
---

When writing or reviewing code for BudgetBliss, enforce these standards strictly.

## Stack Quick Reference
- Next.js 16 App Router | TypeScript strict | MongoDB/Mongoose | NextAuth v5 | Tailwind v4 + shadcn/ui
- Claude `claude-haiku-4-5-20251001` for receipt extraction
- Sharp for image optimization | react-grid-layout for dashboard | Recharts for charts

## Hard Rules

### 1. TypeScript — no `any`, ever
```typescript
// WRONG
const data: any = response;
function handler(req: any) {}

// CORRECT
const data: ExtractedReceipt = response;
function handler(req: NextRequest) {}
```

### 2. Money = integer cents in DB
```typescript
// WRONG: storing floats
const doc = new Receipt({ grandTotal: 12.50 });

// CORRECT: convert at boundary
import { toCents } from "@/lib/utils/currency";
const doc = new Receipt({ grandTotal: toCents(12.50) }); // 1250

// Display only:
import { formatCurrency } from "@/lib/utils/currency";
const display = formatCurrency(doc.grandTotal); // "$12.50"
```

### 3. Zod validates all API inputs
```typescript
// Every route handler before touching data:
const BodySchema = z.object({ storeName: z.string().min(1), grandTotal: z.number().int().positive() });
const body = BodySchema.parse(await req.json());
// Zod throws ZodError → catch and return 400
```

### 4. Auth check first in every API route
```typescript
const session = await auth();
if (!session) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
```

### 5. connectDB before every Mongoose call
```typescript
await connectDB(); // always — it's a no-op if already connected
```

### 6. Structured logging — no console.log
```typescript
import { logger } from "@/lib/logger";
logger.info({ context: "upload", receiptId: id }, "Receipt saved");
logger.error({ context: "claude-api", error: err }, "Extraction failed");
```

### 7. API errors — typed shape only
```typescript
// WRONG
return NextResponse.json({ error: err.message }, { status: 500 });

// CORRECT
return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
```

### 8. shadcn/ui first — don't rebuild primitives
```typescript
// Use: Button, Input, Card, Dialog, Badge, Toast, Table from src/components/ui/
// Don't create custom button/input/dialog components
```

## HTTP Status + Error Code Reference
| Situation | Status | Code |
|---|---|---|
| Zod validation failure | 400 | `VALIDATION_ERROR` |
| Not authenticated | 401 | `UNAUTHORIZED` |
| Not found | 404 | `NOT_FOUND` |
| Invalid file type | 415 | `INVALID_FILE_TYPE` |
| Duplicate image hash | 409 | `DUPLICATE_RECEIPT` |
| Not a receipt | 422 | `NOT_A_RECEIPT` |
| Claude API down | 503 | `AI_SERVICE_UNAVAILABLE` |
| Unexpected error | 500 | `INTERNAL_ERROR` |

## extractionMethod field values
- `'claude'` — fully extracted and Zod-validated
- `'claude-partial'` — extracted but some fields failed validation
- `'failed'` — Claude API error or total parse failure
- `'manual'` — admin entered by hand

## File Structure Quick Map
```
src/lib/models/     — Mongoose schemas (Receipt, User)
src/lib/api/        — External API clients (claude.ts)
src/lib/image/      — Sharp pipeline (optimize.ts, hash.ts)
src/lib/auth/       — NextAuth config (auth.ts)
src/lib/db/         — Mongoose connection + seeding
src/lib/utils/      — currency.ts, dates.ts, validators.ts
src/lib/config.ts   — All env vars typed and validated
src/types/          — Shared TypeScript types
src/components/ui/  — shadcn/ui primitives
src/__tests__/      — Mirror of src/ for tests
```
