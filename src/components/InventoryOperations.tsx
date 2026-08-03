import { useState } from 'react';
import { Boxes, ClipboardX, Flame } from 'lucide-react';
import type { Tag, MetalRate, OldGoldVoucher, Branch } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import InventoryDashboardPanel from './InventoryDashboardPanel';
import StockAdjustmentPanel from './StockAdjustmentPanel';
import MeltingPanel from './MeltingPanel';
import type { StockAdjustment } from '../lib/stockAdjustment';
import type { MeltBatch } from '../lib/melting';
import type { AuditResult } from '../lib/stockAudit';
import { can, type Role } from '../lib/permissions';

interface InventoryOperationsProps {
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  metalRates: MetalRate[];
  oldGoldVouchers: OldGoldVoucher[];
  setOldGoldVouchers: React.Dispatch<React.SetStateAction<OldGoldVoucher[]>>;
  adjustments: StockAdjustment[];
  setAdjustments: React.Dispatch<React.SetStateAction<StockAdjustment[]>>;
  meltBatches: MeltBatch[];
  setMeltBatches: React.Dispatch<React.SetStateAction<MeltBatch[]>>;
  activeBranch: Branch | null;
  currentRole: Role | null;
  currentUserName: string;
  lastAudit: AuditResult | null;
}

const TABS = [
  { key: 'dashboard' as const, label: 'Inventory Dashboard', icon: Boxes },
  { key: 'adjustment' as const, label: 'Adjustments', icon: ClipboardX },
  { key: 'melting' as const, label: 'Melting', icon: Flame },
];

/**
 * Phase 13 (Milestones 42–44). The three sit together because they are the same subject seen
 * three ways: what stock the shop has, how it leaves without being sold, and how it is turned
 * back into metal.
 */
export default function InventoryOperations(props: InventoryOperationsProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [tab, setTab] = useState<'dashboard' | 'adjustment' | 'melting'>('dashboard');

  // Both write-off and melting permanently remove stock, so both sit behind the same permission.
  const canManage = can(props.currentRole, 'catalog.manage');

  return (
    <div className="space-y-6">
      <div className={`flex gap-1 p-1 rounded-xl border w-fit ${
        dark ? 'bg-[#141416] border-[#262626]' : 'bg-white border-slate-150'
      }`}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === t.key
                ? 'bg-[#C5A059] text-[#0A0A0B]'
                : dark ? 'text-zinc-400 hover:text-zinc-100' : 'text-slate-500 hover:text-slate-900'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <InventoryDashboardPanel
          tags={props.tags}
          metalRates={props.metalRates}
          lastAudit={props.lastAudit}
        />
      )}

      {tab === 'adjustment' && (
        <StockAdjustmentPanel
          tags={props.tags}
          setTags={props.setTags}
          adjustments={props.adjustments}
          setAdjustments={props.setAdjustments}
          metalRates={props.metalRates}
          activeBranch={props.activeBranch}
          currentUserName={props.currentUserName}
          canManage={canManage}
        />
      )}

      {tab === 'melting' && (
        <MeltingPanel
          tags={props.tags}
          setTags={props.setTags}
          oldGoldVouchers={props.oldGoldVouchers}
          setOldGoldVouchers={props.setOldGoldVouchers}
          batches={props.meltBatches}
          setBatches={props.setMeltBatches}
          activeBranch={props.activeBranch}
          currentUserName={props.currentUserName}
          canManage={canManage}
        />
      )}
    </div>
  );
}
