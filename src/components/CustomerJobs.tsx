import { useState } from 'react';
import { ClipboardList, Wrench } from 'lucide-react';
import type { Branch, Karigar, MetalRate } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import OrderManager from './OrderManager';
import RepairManager from './RepairManager';
import type { CustomerOrder } from '../lib/customerOrder';
import type { RepairJob } from '../lib/repairJob';

interface CustomerJobsProps {
  orders: CustomerOrder[];
  setOrders: React.Dispatch<React.SetStateAction<CustomerOrder[]>>;
  repairJobs: RepairJob[];
  setRepairJobs: React.Dispatch<React.SetStateAction<RepairJob[]>>;
  karigars: Karigar[];
  metalRates: MetalRate[];
  activeBranch: Branch | null;
  currentUserName: string;
  canManage: boolean;
}

const TABS = [
  { key: 'orders' as const, label: 'Customer Orders', icon: ClipboardList },
  { key: 'repairs' as const, label: 'Repairs & Service', icon: Wrench },
];

/**
 * Orders (M55) and repairs (M54) share a screen because they are the same situation from the
 * counter's point of view: a customer is waiting for something, and the shop is holding either
 * their money or their property until it is handed over.
 */
export default function CustomerJobs(props: CustomerJobsProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [tab, setTab] = useState<'orders' | 'repairs'>('orders');

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

      {tab === 'orders' ? (
        <OrderManager
          orders={props.orders}
          setOrders={props.setOrders}
          metalRates={props.metalRates}
          activeBranch={props.activeBranch}
          currentUserName={props.currentUserName}
          canManage={props.canManage}
        />
      ) : (
        <RepairManager
          jobs={props.repairJobs}
          setJobs={props.setRepairJobs}
          karigars={props.karigars}
          activeBranch={props.activeBranch}
          currentUserName={props.currentUserName}
          canManage={props.canManage}
        />
      )}
    </div>
  );
}
