# BACKEND_GUIDE.md — how the stack actually works

_For developers who know Express and React but have not used NestJS, Drizzle or Postgres RLS.
Written 2026-08-04. Companion to `BACKEND_ARCHITECTURE.md`, which says **what** we are building;
this says **how** the pieces work._

The whole guide builds **one real endpoint** — the stock write-off from Milestone 42 — because a
worked example in our own domain teaches more than a generic to-do list. By the end you will have
seen a request travel from HTTP to Postgres and back, through every layer.

---

## 1. The mental model, coming from Express

Nest is Express underneath. It adds three things: **classes with decorators** instead of route
callbacks, **dependency injection** instead of imports, and **modules** instead of one big
`app.use()` chain.

Here is the same endpoint both ways.

**Express, as you know it:**

```js
app.post('/adjustments', async (req, res) => {
  const user = await getUserFromToken(req.headers.authorization);
  if (!user.permissions.includes('catalog.manage')) return res.status(403).send();
  const tags = await db.query('SELECT * FROM tags WHERE tenant_id = $1', [user.tenantId]);
  // …validate, write, respond — all in one function
});
```

**Nest, the same thing split into jobs:**

```ts
@Controller('adjustments')
export class AdjustmentController {
  constructor(private readonly service: AdjustmentService) {}   // ← injected, not imported

  @Post()
  @RequirePermission('catalog.manage')                          // ← a guard does the 403
  create(@Body() dto: CreateAdjustmentDto, @Ctx() ctx: RequestContext) {
    return this.service.create(dto, ctx);                       // ← one call, no logic here
  }
}
```

The controller shrank because the cross-cutting work moved into reusable pieces:

| Nest concept | The Express equivalent | What we use it for |
|---|---|---|
| **Module** | a folder + `router.use()` | one bounded context (Inventory, Sales…) |
| **Controller** | `app.post(...)` | HTTP only — parse, validate, delegate |
| **Service** | the body of your route handler | the use case, transactions |
| **Provider / DI** | `require()` at the top | swappable, mockable dependencies |
| **Guard** | `requireAuth` middleware | authn + our permission checks |
| **Pipe** | `validate(req.body)` | Zod validation, in one place |
| **Interceptor** | wrapper middleware | tenant context, logging, timing |

**The one habit to unlearn:** in Express you `require` a module directly. In Nest you declare it in
the constructor and Nest supplies it. That is what makes a service testable without a database.

---

## 2. Drizzle — a typed way to write SQL

Drizzle is not an ORM in the Rails sense. You describe tables in TypeScript, and it gives you typed
SQL. If you can read SQL, you can read Drizzle.

**Defining a table** (`packages/db/schema/tags.ts`):

```ts
import { pgTable, uuid, text, bigint, timestamp, index } from 'drizzle-orm/pg-core';

export const tags = pgTable('tags', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull(),
  branchId:      uuid('branch_id'),
  sku:           text('sku').notNull(),
  huid:          text('huid'),
  status:        text('status').notNull(),
  // Money in paisa, weight in milligrams — both BIGINT. Never float. (D-12)
  grossWeightMg: bigint('gross_weight_mg', { mode: 'number' }).notNull(),
  netWeightMg:   bigint('net_weight_mg',   { mode: 'number' }).notNull(),
  taggedOn:      timestamp('tagged_on', { withTimezone: true }),
}, (t) => ({
  tenantIdx: index('tags_tenant_idx').on(t.tenantId, t.branchId),
}));
```

**Querying:**

```ts
const rows = await db.select().from(tags).where(eq(tags.status, 'InStock'));
```

Note what is *missing*: no `tenant_id` in that `where`. That is deliberate — the next section
explains why it is still safe.

**Migrations** are generated from the schema and checked into git:

```bash
pnpm drizzle-kit generate      # writes a .sql file you can read and review
pnpm drizzle-kit migrate       # applies it
```

Review the generated SQL in the pull request. It is the only place a destructive change to a
jeweller's books can hide.

---

## 3. Row-Level Security — the part you cannot Google for our case

This is the most important mechanism in the whole backend, so it gets the longest explanation.

**The problem.** Every table holds every tenant's data. One forgotten `WHERE tenant_id = …` shows
shop A the stock of shop B. Code review will not catch this forever.

**The solution.** Let Postgres do the filtering. It cannot forget.

**Step 1 — turn it on, once per table, in a migration:**

```sql
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tags
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

`USING` is the filter applied to every `SELECT`/`UPDATE`/`DELETE`, automatically, forever.

**Step 2 — tell Postgres who is asking, once per request:**

```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL app.tenant_id = ${ctx.tenantId}`);
  // every query in this transaction is now filtered by Postgres
});
```

`SET LOCAL` lasts only for this transaction, which is why it is safe when connections are pooled and
reused by other requests.

**What this buys us.** Run the earlier query as tenant A and you get tenant A's tags. Run it with no
tenant set and you get **zero rows** — not an error, not everything. The failure mode of forgetting
is emptiness, never a leak.

> **Do not connect as the Postgres superuser.** RLS is bypassed for superusers and table owners. The
> application connects as a restricted role, or none of this works. This is the single easiest way
> to silently disable the whole protection.

**Step 3 — prove it, in CI:**

```ts
it('cannot read another tenant\'s tags', async () => {
  await seedTag({ tenantId: TENANT_A, sku: 'RNG-001' });
  const rows = await asTenant(TENANT_B, (tx) => tx.select().from(tags));
  expect(rows).toHaveLength(0);
});
```

This test runs on every pull request. It is the one that stops a catastrophe.

---

## 4. Clerk — where authentication stops and we begin

Clerk answers *"who is this person and are they really them"*. Everything after that is ours (D-14).

The flow:

```
Browser ──(Clerk session token)──► Guard verifies token with Clerk
                                    │
                                    ├─ clerk_user_id  → our users row → role, branch, is_active
                                    ├─ clerk_org_id   → our tenants row → tenantId
                                    └─ builds RequestContext { tenantId, userId, role, branchId }
```

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly users: UserRepository) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const claims = await verifyToken(extractBearer(req));      // Clerk verifies the signature

    const user = await this.users.findByClerkId(claims.sub);
    if (!user || !user.isActive) return false;                 // M49: deactivated stops working now

    req.ctx = {
      tenantId: user.tenantId,
      userId:   user.id,
      role:     user.roleName,
      branchId: user.branchId,
    };
    return true;
  }
}
```

Then permissions — **our** code, unchanged from the frontend:

```ts
import { can } from '@stitch/domain/permissions';   // the same file the React app uses

@Injectable()
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<Permission>('permission', context.getHandler());
    const { role } = context.switchToHttp().getRequest().ctx;
    return can(role, required);
  }
}
```

That is `permissions.ts` from `src/lib/`, running server-side. This is the moment the comment in
that file — *"this gates the interface, not the data"* — stops being true, because now it gates the
data too.

**The supervisor PIN stays ours and stays in Postgres**, hashed. It is not an authentication factor;
it records that a second person authorised a discount (M33). Clerk never sees it.

---

## 5. One endpoint, end to end

`POST /adjustments` — write off a damaged piece. Follow the numbered comments.

### The DTO (`dto/create-adjustment.dto.ts`)

```ts
import { z } from 'zod';

export const CreateAdjustmentSchema = z.object({
  tagIds: z.array(z.string().uuid()).min(1),
  reason: z.enum(['DAMAGED', 'LOST', 'SHRINKAGE', 'CORRECTION']),
  note:   z.string().min(10),        // mirrors the domain rule; the domain still re-checks
});

export type CreateAdjustmentDto = z.infer<typeof CreateAdjustmentSchema>;
```

Shape validation only. **Business rules live in the domain**, not here — this stops a malformed
request early, it does not decide anything.

### The controller

```ts
@Controller('adjustments')
@UseGuards(AuthGuard, PermissionGuard)
export class AdjustmentController {
  constructor(private readonly service: AdjustmentService) {}

  @Post()
  @RequirePermission('catalog.manage')
  @UsePipes(new ZodValidationPipe(CreateAdjustmentSchema))
  create(@Body() dto: CreateAdjustmentDto, @Ctx() ctx: RequestContext) {
    return this.service.create(dto, ctx);
  }
}
```

Four lines of body. If you ever find an `if` about *domain meaning* in a controller, it is in the
wrong layer.

### The service — the only place that knows about both worlds

```ts
@Injectable()
export class AdjustmentService {
  constructor(
    private readonly db: Database,
    private readonly tagRepo: TagRepository,
    private readonly rateRepo: RateRepository,
    private readonly adjRepo: AdjustmentRepository,
  ) {}

  async create(dto: CreateAdjustmentDto, ctx: RequestContext) {
    return this.db.transaction(async (tx) => {
      // 1. Identify the tenant. Every query below is now RLS-filtered.
      await tx.execute(sql`SET LOCAL app.tenant_id = ${ctx.tenantId}`);

      // 2. LOAD — repositories return domain-shaped objects (rupees, grams).
      const tags  = await this.tagRepo.findByIds(tx, dto.tagIds);
      const rates = await this.rateRepo.currentRates(tx);

      // 3. DECIDE — pure domain. No database, no HTTP. Already tested.
      const draft = { ...dto, adjustedBy: ctx.userName };
      const error = validateAdjustment(draft, tags);
      if (error) throw new BadRequestException(error);

      const adjustmentNo = await this.adjRepo.nextNumber(tx);
      const adjustment   = buildAdjustment(draft, tags, rates, adjustmentNo, today(), ctx.branchId);
      const updatedTags  = applyAdjustment(adjustment, tags);   // moves via the state machine

      // 4. PERSIST — one transaction. Either all of this happens or none of it does.
      await this.adjRepo.insert(tx, adjustment);
      await this.tagRepo.updateStatuses(tx, updatedTags);
      await this.tagRepo.appendEvents(tx, updatedTags, {
        reason: 'STOCK_ADJUSTMENT', actor: ctx.userId,        // append-only lifecycle trail
      });

      return adjustment;
    });
  }
}
```

Read step 3 again: `validateAdjustment`, `buildAdjustment` and `applyAdjustment` are the functions
already in `src/lib/stockAdjustment.ts`, already covered by 33 tests. **The backend did not
re-implement the ITC-reversal rule.** It loaded data, called them, and saved the result.

### The repository — and the one conversion that matters

```ts
@Injectable()
export class TagRepository {
  async findByIds(tx: Tx, ids: string[]): Promise<Tag[]> {
    const rows = await tx.select().from(tags).where(inArray(tags.id, ids));
    return rows.map(toDomain);
  }
}

// The database stores integers. The domain works in rupees and grams. This is the seam.
function toDomain(row: TagRow): Tag {
  return {
    id: row.id,
    sku: row.sku,
    status: row.status as TagStatus,
    netWeight:   row.netWeightMg / 1000,          // mg → g
    grossWeight: row.grossWeightMg / 1000,
    stoneCharge: fromPaisa(row.stoneChargePaisa), // paisa → rupees
    // …
  };
}
```

**Conversion happens here and nowhere else.** If a paisa-to-rupee conversion appears in a service or
a controller, two places now know the storage format and they will disagree eventually.

### What happens when the request arrives

```
POST /adjustments
  │
  ├─ AuthGuard         verify Clerk token → load our user → build ctx     (401 if bad)
  ├─ PermissionGuard   can(role, 'catalog.manage')                        (403 if not)
  ├─ ZodValidationPipe shape check                                        (400 if malformed)
  │
  ├─ Controller        calls the service
  │   └─ Service       BEGIN
  │        ├─ SET LOCAL app.tenant_id
  │        ├─ repositories load          → Postgres filters by tenant
  │        ├─ domain decides             → pure functions, no I/O
  │        ├─ repositories persist
  │        └─ COMMIT                     ← any throw above rolls everything back
  │
  └─ 201 { adjustmentNo: 'ADJ-2026-1', … }
```

---

## 6. Running it locally

```bash
# 1. Postgres in Docker
docker run --name stitch-db -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16

# 2. Environment
cat > apps/api/.env <<'EOF'
DATABASE_URL=postgres://stitch_app:dev@localhost:5432/stitch
CLERK_SECRET_KEY=sk_test_...
REDIS_URL=redis://localhost:6379
EOF

# 3. Schema
pnpm drizzle-kit generate && pnpm drizzle-kit migrate

# 4. Run
pnpm --filter api start:dev      # http://localhost:3001, reloads on save
```

Create the restricted role once — **not** the superuser, or RLS is bypassed:

```sql
CREATE ROLE stitch_app LOGIN PASSWORD 'dev';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stitch_app;

-- Append-only tables: no UPDATE, no DELETE, ever (D-4)
REVOKE UPDATE, DELETE ON metal_rate_versions, tax_rates, karigar_ledger, approvals
  FROM stitch_app;
```

That last statement is a domain rule expressed as a database grant. A developer who later writes
`UPDATE metal_rate_versions` gets a permission error rather than a silently rewritten audit trail.

---

## 7. Learning order

Roughly a week before writing production code. Learn in this order — each builds on the last:

1. **Postgres + SQL basics** (1 day) — joins, transactions, indexes. You will read more SQL than you
   write, because Drizzle output is SQL.
2. **RLS specifically** (half a day) — policies, `current_setting`, why the app role must not be
   superuser. Section 3 above plus the Postgres docs on `CREATE POLICY`.
3. **Drizzle** (half a day) — schema, queries, transactions, migrations.
4. **Nest fundamentals** (2 days) — modules, controllers, providers, DI, guards, pipes. Do the
   official overview; skip GraphQL, microservices and CQRS entirely for now.
5. **Clerk backend SDK** (half a day) — verifying a token, reading org claims.

**Skip for now:** Nest's CQRS module, event sourcing, microservices, GraphQL. All are advertised
prominently and none are needed here.

The fastest way through is to build Branches end to end yourself after reading section 5 — it is the
same shape as the write-off, with less domain logic in the middle.

---

## 8. The five mistakes to expect

1. **Connecting as superuser in development.** RLS silently does nothing, everything works, and the
   leak appears in production. Use `stitch_app` from day one.
2. **Business logic drifting into controllers.** It starts as one `if`. Keep them at four lines.
3. **Importing a repository into `packages/domain`.** The 1264 tests then need a database, stop
   running in milliseconds, and stop being run. Reject in review.
4. **Doing money maths in JavaScript floats.** `0.1 + 0.2`. Use `money.ts` — it exists precisely for
   this — and `BIGINT` columns.
5. **Forgetting idempotency on POST.** The offline queue (M36) retries. Without an idempotency key a
   retried sale becomes two invoices and two GST liabilities.

---

## 9. What this guide does not cover

Deployment, CI, observability, rate limiting, backups and the worker/BullMQ setup. All are real and
none block writing the first endpoint. `BACKEND_ARCHITECTURE.md` §8 lists the open infrastructure
decisions.
