# Stitch Jewellery ERP

Vite + React 19 + TypeScript + Tailwind SPA, with an Express server for production. Path alias `@/*` maps to the repo root.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (port 3000) |
| Typecheck | `npm run lint` (`tsc --noEmit`) |
| Tests | `npm test` (`vitest run`) |
| Production build | `npm run build` |

## Working agreement

Work like a senior engineer who owns this codebase. When given a task, carry it through to completion without checking in at each step.

**Decide, don't ask.** Reading files, searching, opening modules to understand context, running typecheck/tests/build, creating the files a feature needs, refactoring shared code the change touches, picking names, choosing where code lives, adding types — these are the job, not decisions to escalate. Make the call a senior developer would make and keep moving. Never ask "should I open/read/check X?" — just do it.

**Finish the whole task.** A feature is done when the type, the logic, the UI, the wiring, and the tests all exist and pass — not when the happy path renders. If part of the scope turns out to be blocked, complete everything else and say plainly at the end what was left and why.

**State assumptions instead of blocking on them.** If a requirement is ambiguous, pick the interpretation that fits the existing codebase, implement it, and note the assumption in the final summary. Only stop mid-task if proceeding either way would be unsafe or would make the work useless if the guess is wrong.

## Definition of done

Every change ships production-ready. Before reporting a task complete:

1. `npm run lint` passes — no type errors, no `any` used to silence the compiler.
2. `npm test` passes. New logic in `src/lib/` gets unit tests alongside it (`*.test.ts`); this is where the domain rules live and where bugs are most expensive.
3. `npm run build` succeeds.
4. The change is verified in the browser, not just asserted to compile — see [[verify-changes-in-browser]].

Report results honestly. If tests fail, say so and show the output; never describe unverified work as working.

## Quality bar

This is a production SaaS, not a prototype. Hold to it:

- **Handle the unhappy paths.** Loading, empty, and error states are part of the feature. No unhandled promise rejections; no silent `catch {}`.
- **Money and weight are domain-critical.** Gold weights, rates, wastage, and valuations must not accumulate floating-point drift or round inconsistently. Follow the rounding and unit conventions already established in `src/lib/` rather than inventing new ones.
- **Never break persisted data shapes.** Changing a stored/serialized structure requires handling records already written in the old shape.
- **Match the surrounding code** — its naming, file layout, component patterns, and Tailwind conventions. Consistency beats personal preference.
- **Keep types honest.** Extend the shared types in `src/types.ts` rather than casting at call sites.

## When to actually interrupt

Only for things that are destructive, irreversible, or outside the requested scope:

- Deleting or bulk-rewriting files the task didn't call for
- Destructive git operations (force-push, hard reset, `git clean`)
- Migrations or changes that would discard or rewrite existing records
- Publishing, deploying, or anything outward-facing
- A product decision with real business consequence that the codebase can't answer — pricing rules, tax treatment, who can see what

Everything else: proceed.
