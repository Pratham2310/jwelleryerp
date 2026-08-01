import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  UserPlus, 
  Coins, 
  Calendar, 
  Award, 
  Check, 
  X, 
  CreditCard, 
  TrendingUp, 
  Clock,
  UserCheck
} from 'lucide-react';
import { Customer, SavingsScheme, SchemeEnrollment, SchemeInstalment, Branch, Supplier, SaleInvoice } from '../types';
import SchemeManager from './SchemeManager';
import SupplierManager from './SupplierManager';
import Customer360Drawer from './Customer360Drawer';

interface CustomerManagerProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  // Gold Savings Schemes (Milestones 26-27). Enrollment balances are derived from the
  // instalment receipts, so none of these carry a stored balance.
  schemes: SavingsScheme[];
  setSchemes: React.Dispatch<React.SetStateAction<SavingsScheme[]>>;
  enrollments: SchemeEnrollment[];
  setEnrollments: React.Dispatch<React.SetStateAction<SchemeEnrollment[]>>;
  instalments: SchemeInstalment[];
  setInstalments: React.Dispatch<React.SetStateAction<SchemeInstalment[]>>;
  activeBranch: Branch | null;
  /** Supplier Master (Milestone 37) — the creditor side of the same Party Master. */
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  /** Customer 360 (Milestone 31) — history is derived from the invoice register. */
  invoices: SaleInvoice[];
}

export default function CustomerManager({
  customers, setCustomers, schemes, setSchemes, enrollments, setEnrollments,
  instalments, setInstalments, activeBranch, suppliers, setSuppliers, invoices,
}: CustomerManagerProps) {
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'customers' | 'schemes' | 'suppliers'>('customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  
  // Active selected customer for scheme milestone viewing
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // New Customer Form State
  const [newCust, setNewCust] = useState<Partial<Customer>>({
    name: '',
    phone: '',
    email: '',
    tier: 'Bronze',
    loyaltyPoints: 0,
    lifetimeSpend: 0,
    savingsSchemeActive: false,
    savingsSchemeBalance: 0
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name || !newCust.phone) {
      alert("Please provide at least Name and Phone!");
      return;
    }

    const added: Customer = {
      id: `cust-${Date.now()}`,
      name: newCust.name,
      phone: newCust.phone,
      email: newCust.email || 'N/A',
      tier: (newCust.lifetimeSpend || 0) > 400000 ? 'Platinum' : (newCust.lifetimeSpend || 0) > 150000 ? 'Gold' : 'Silver',
      loyaltyPoints: Math.round((newCust.lifetimeSpend || 0) * 0.01),
      lifetimeSpend: Number(newCust.lifetimeSpend || 0),
      savingsSchemeActive: !!newCust.savingsSchemeActive,
      savingsSchemeMaturityDate: newCust.savingsSchemeActive ? '2027-06-15' : undefined,
      savingsSchemeBalance: newCust.savingsSchemeActive ? Number(newCust.savingsSchemeBalance || 0) : 0
    };

    setCustomers(prev => [added, ...prev]);
    setAddModalOpen(false);
    
    // Reset Form
    setNewCust({
      name: '',
      phone: '',
      email: '',
      tier: 'Bronze',
      loyaltyPoints: 0,
      lifetimeSpend: 0,
      savingsSchemeActive: false,
      savingsSchemeBalance: 0
    });
  };

  const handleAddInstallment = (id: string, installmentAmount: number = 5000) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          savingsSchemeBalance: Number((c.savingsSchemeBalance || 0) + installmentAmount),
          loyaltyPoints: c.loyaltyPoints + 50 // bonus loyalty points
        };
      }
      return c;
    }));
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Platinum': return 'bg-slate-900 text-slate-100 border-slate-900';
      case 'Gold': return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'Silver': return 'bg-slate-100 text-slate-700 border-slate-300';
      default: return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  };

  const activeCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-6">
      {/* Tabs — CRM and the savings-scheme book are two views of the same customer base */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 pb-px gap-6 items-center">
        {([
          { key: 'customers', label: 'Customer Directory' },
          { key: 'schemes', label: 'Gold Savings Schemes' },
          { key: 'suppliers', label: 'Suppliers' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`pb-3 text-sm font-bold transition relative cursor-pointer ${
              activeTab === t.key ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
            {activeTab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />}
          </button>
        ))}
      </div>

      {activeTab === 'suppliers' ? (
        <SupplierManager suppliers={suppliers} setSuppliers={setSuppliers} />
      ) : activeTab === 'schemes' ? (
        <SchemeManager
          customers={customers}
          schemes={schemes}
          setSchemes={setSchemes}
          enrollments={enrollments}
          setEnrollments={setEnrollments}
          instalments={instalments}
          setInstalments={setInstalments}
          activeBranch={activeBranch}
        />
      ) : (
      <div className="space-y-6">
      {/* Search and intake Header */}
      <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer by name, contact phone, or email ID..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition duration-150 shrink-0 w-full md:w-auto justify-center"
        >
          <UserPlus className="w-4.5 h-4.5" /> Register Customer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Directory Table (2/3 width) */}
        <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/40">
            <Users className="w-5 h-5 text-amber-600" />
            <h4 className="font-sans font-bold text-slate-800 text-sm">CRM Profile Database</h4>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-600">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 font-mono font-bold uppercase tracking-wider">
                  <th className="p-4">Customer Details</th>
                  <th>Tier Card</th>
                  <th>Loyalty points</th>
                  <th>Total Spend</th>
                  <th>Savings Scheme</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCustomers.map((cust) => (
                  <tr 
                    key={cust.id} 
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`hover:bg-amber-50/20 cursor-pointer transition ${
                      selectedCustomerId === cust.id ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td className="p-4">
                      <div className="font-black text-slate-900 text-sm leading-tight">{cust.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{cust.phone} • {cust.email}</div>
                    </td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getTierColor(cust.tier)}`}>
                        {cust.tier}
                      </span>
                    </td>
                    <td className="font-mono font-bold text-slate-800">{cust.loyaltyPoints} PTS</td>
                    <td className="font-mono text-slate-900 font-black">₹{cust.lifetimeSpend.toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cust.savingsSchemeActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {cust.savingsSchemeActive ? 'ACTIVE (11-Mo)' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          className="text-xs font-bold text-amber-700 hover:underline"
                          onClick={() => setProfileCustomerId(cust.id)}
                        >
                          Customer 360
                        </button>
                        <button
                          className="text-xs font-bold text-amber-700 hover:underline"
                          onClick={() => setSelectedCustomerId(cust.id)}
                        >
                          Track Scheme
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Savings Scheme tracker (1/3 width) */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-600" />
              <h3 className="font-sans font-bold text-slate-800 text-sm">"Swarna Nidhi" Savings Scheme</h3>
            </div>

            {activeCustomer ? (
              activeCustomer.savingsSchemeActive ? (
                /* ACTIVE SCHEME PROGRESS TRACKER */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-widest block leading-none">Scheme Member</span>
                    <h4 className="font-sans font-black text-slate-900 text-base leading-tight">{activeCustomer.name}</h4>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      Maturity Target: {activeCustomer.savingsSchemeMaturityDate}
                    </span>
                  </div>

                  {/* Balance ledger */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl relative overflow-hidden border border-slate-800 space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-widest">Accumulated Fund Value</span>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xl font-black font-mono text-amber-400">₹{(activeCustomer.savingsSchemeBalance || 0).toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-slate-400">/ ₹55,000 Target</span>
                    </div>
                  </div>

                  {/* Interactive Installments Tracker */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-widest block">Monthly Milestones (5,000 / Mo)</span>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 11 }).map((_, index) => {
                        const paidSoFar = (activeCustomer.savingsSchemeBalance || 0) / 5000;
                        const isPaid = index < paidSoFar;
                        return (
                          <div
                            key={index}
                            title={`Month ${index + 1}: ${isPaid ? 'Paid' : 'Unpaid'}`}
                            className={`text-center py-2.5 rounded-lg border font-mono text-xs font-black transition duration-200 ${
                              isPaid 
                                ? 'bg-emerald-500 border-emerald-600 text-white' 
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            M{index + 1}
                          </div>
                        );
                      })}
                      <div className="text-center py-2.5 rounded-lg border-2 border-dashed border-amber-400 text-amber-800 font-bold text-xs bg-amber-50/40">
                        Bonus
                      </div>
                    </div>
                  </div>

                  {/* Add installment transaction */}
                  <div className="pt-3 border-t">
                    <button
                      onClick={() => handleAddInstallment(activeCustomer.id, 5000)}
                      className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2.5 rounded-xl shadow-sm transition"
                    >
                      <Plus className="w-4 h-4" /> Deposit Monthly ₹5,000
                    </button>
                    <p className="text-[9px] text-center text-slate-400 mt-2 font-mono">Deducted from customer linked banking wallet</p>
                  </div>
                </div>
              ) : (
                /* SCHEME IS INACTIVE */
                <div className="text-center py-8 space-y-4">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 text-sm">No Active Savings Scheme</p>
                    <p className="text-xs text-slate-400 px-4">Activate Swarna Nidhi monthly recurring scheme for {activeCustomer.name} to hedge against fluctuating gold rates.</p>
                  </div>
                  <button
                    onClick={() => {
                      setCustomers(prev => prev.map(c => {
                        if (c.id === activeCustomer.id) {
                          return {
                            ...c,
                            savingsSchemeActive: true,
                            savingsSchemeBalance: 5000,
                            savingsSchemeMaturityDate: '2027-06-20'
                          };
                        }
                        return c;
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
                  >
                    Activate Gold Scheme
                  </button>
                </div>
              )
            ) : (
              /* NO CUSTOMER SELECTED */
              <div className="text-center py-10 text-slate-400">
                <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-500">Select customer profile from database ledger to view active savings plans.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* REGISTER NEW CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <h3 className="font-sans font-bold text-slate-900 text-base">Register Counter CRM Customer</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="p-6 space-y-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shrutika Deshpande"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Phone Contact *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9811223344"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    value={newCust.phone}
                    onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. shrutika@example.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    value={newCust.email}
                    onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Starting Lifetime spend (₹)</label>
                <input
                  type="number"
                  placeholder="₹0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none"
                  value={newCust.lifetimeSpend || ''}
                  onChange={(e) => setNewCust({ ...newCust, lifetimeSpend: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">Enroll in 11-Month Swarna Nidhi Savings Scheme?</p>
                    <p className="text-[10px] text-slate-400">Allows customer to deposit monthly funds with rate protection.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-4.5 h-4.5 text-amber-500 focus:ring-amber-500 rounded border-slate-300"
                    checked={!!newCust.savingsSchemeActive}
                    onChange={(e) => setNewCust({ ...newCust, savingsSchemeActive: e.target.checked })}
                  />
                </div>

                {newCust.savingsSchemeActive && (
                  <div>
                    <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Initial scheme Deposit (₹)</label>
                    <input
                      type="number"
                      placeholder="₹5000"
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg font-mono focus:outline-none"
                      value={newCust.savingsSchemeBalance || ''}
                      onChange={(e) => setNewCust({ ...newCust, savingsSchemeBalance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition"
                >
                  Create & Auto-Assign Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {profileCustomerId && (() => {
        const c = customers.find(x => x.id === profileCustomerId);
        return c ? (
          <Customer360Drawer
            customer={c}
            invoices={invoices}
            schemes={schemes}
            enrollments={enrollments}
            instalments={instalments}
            onClose={() => setProfileCustomerId(null)}
          />
        ) : null;
      })()}
      </div>
      )}
    </div>
  );
}
