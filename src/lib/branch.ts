/**
 * Branch Master & scoping (PRD §2/§4.8, Handbook §2.10, Milestone 19).
 *
 * Decision D-1 locks the target as a multi-branch regional chain: every stock-bearing record
 * carries a branch, and rates are HQ-set with a controlled branch-level override.
 *
 * Decision D-5 is the important counterweight and is enforced here by omission: Party Master
 * (Customer, Karigar) and the Metal/Purity Master are **never** branch-scoped. Branch-scoping
 * customers is called out in D-5 as "a common, subtle mistake that silently breaks both
 * chain-wide loyalty and TCS aggregation" — a compliance risk, not a UX preference. So the
 * scoping helpers below are deliberately applied only to stock-bearing records.
 */

import type { Branch, MetalRate } from '../types';

/** Records that live in exactly one branch. Party/rate masters are deliberately absent. */
export interface BranchScoped {
  branchId?: string;
}

export function getActiveBranch(branches: Branch[], activeBranchId: string | null): Branch | null {
  if (!branches.length) return null;
  return branches.find(b => b.id === activeBranchId) ?? branches[0];
}

/** The branch legacy records are attributed to when they predate branch tracking. */
export function primaryBranchId(branches: Branch[]): string | null {
  return branches[0]?.id ?? null;
}

/**
 * A record with no `branchId` predates Milestone 19. It is attributed to the primary branch
 * rather than shown everywhere — showing it in every branch would double-count real stock,
 * and hiding it entirely would make a user's existing data silently vanish.
 */
export function belongsToBranch(
  record: BranchScoped,
  branchId: string | null,
  fallbackBranchId: string | null
): boolean {
  if (!branchId) return true; // no branch selected yet — don't hide anything
  const effective = record.branchId ?? fallbackBranchId;
  return effective === branchId;
}

export function scopeToBranch<T extends BranchScoped>(
  records: T[],
  branchId: string | null,
  fallbackBranchId: string | null
): T[] {
  if (!branchId) return records;
  return records.filter(r => belongsToBranch(r, branchId, fallbackBranchId));
}

/**
 * Resolves the metal rate for a branch: an explicit branch override wins, otherwise the
 * HQ-set rate (D-1 — "centralized HQ-set with real-time propagation, plus a controlled,
 * permissioned, reason-logged branch-level override"). The reason-logging half of that
 * decision belongs to Milestone 48's append-only Rate Master and is NOT yet implemented.
 */
export function resolveMetalRate(
  rates: MetalRate[],
  branch: Branch | null,
  metalType: string
): number {
  const override = branch?.rateOverrides?.[metalType];
  if (typeof override === 'number' && override > 0) return override;
  return rates.find(r => r.metalType === metalType)?.ratePerGram ?? 0;
}

export function hasRateOverride(branch: Branch | null, metalType: string): boolean {
  const v = branch?.rateOverrides?.[metalType];
  return typeof v === 'number' && v > 0;
}

/**
 * Per-branch, per-financial-year invoice series.
 *
 * GST Rule 46 requires the tax-invoice series to be consecutive *per GSTIN*. Since each branch
 * has its own GSTIN, a single shop-wide counter is non-compliant the moment a second branch
 * exists. This closes the half of `KNOWN_ISSUES.md` #11 that was left open pending Milestone 19.
 */
export function nextBranchInvoiceNumber(
  branch: Branch | null,
  now: Date = new Date(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): string {
  const year = now.getFullYear();
  const prefix = branch?.invoiceSeriesPrefix || 'INV';
  const key = `stitch_invoice_seq_${prefix}_${year}`;
  const next = Number(storage.getItem(key) || '1000') + 1;
  storage.setItem(key, String(next));
  return `${prefix}-${year}-${next}`;
}

/** Whether two branches are in the same state — drives CGST+SGST vs IGST in Milestone 21. */
export function isIntraState(a: Branch | null, b: Branch | null): boolean {
  if (!a || !b) return false;
  return a.stateCode === b.stateCode;
}

export function validateBranch(branch: Partial<Branch>, existing: Branch[] = []): string | null {
  if (!branch.name?.trim()) return 'Branch name is required.';
  if (!branch.branchCode?.trim()) return 'Branch code is required.';
  if (!branch.stateCode?.trim()) return 'State code is required — it determines CGST/SGST vs IGST.';
  if (!branch.invoiceSeriesPrefix?.trim()) return 'An invoice series prefix is required (GST Rule 46).';

  const codeClash = existing.some(
    b => b.id !== branch.id && b.branchCode.toLowerCase() === branch.branchCode!.trim().toLowerCase()
  );
  if (codeClash) return 'That branch code is already in use.';

  // Two branches sharing a series prefix would interleave their invoice numbers, breaking
  // the per-GSTIN consecutiveness Rule 46 requires.
  const prefixClash = existing.some(
    b => b.id !== branch.id
      && b.invoiceSeriesPrefix.toLowerCase() === branch.invoiceSeriesPrefix!.trim().toLowerCase()
  );
  if (prefixClash) {
    return 'That invoice series prefix is already used by another branch — each GSTIN needs its own consecutive series.';
  }

  return null;
}
