import React, { useState } from 'react';
import { 
  Hammer, 
  UserCheck, 
  Coins, 
  Scale, 
  Calendar, 
  TrendingUp, 
  ChevronRight, 
  FilePlus, 
  CheckCircle,
  X,
  History,
  Sparkles,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { Karigar, WorkOrder } from '../types';

interface KarigarManagerProps {
  karigars: Karigar[];
  setKarigars: React.Dispatch<React.SetStateAction<Karigar[]>>;
  workOrders: WorkOrder[];
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  isIssueModalOpen: boolean;
  setIssueModalOpen: (open: boolean) => void;
}

export default function KarigarManager({
  karigars,
  setKarigars,
  workOrders,
  setWorkOrders,
  isIssueModalOpen,
  setIssueModalOpen
}: KarigarManagerProps) {
  // Navigation tabs for Karigar Manager
  const [activeSubTab, setActiveSubTab] = useState<'artisans' | 'orders'>('artisans');

  // Form states for issuing order
  const [selectedKarigarId, setSelectedKarigarId] = useState('');
  const [designName, setDesignName] = useState('');
  const [category, setCategory] = useState('Earrings');
  const [goldIssued, setGoldIssued] = useState<number>(0);
  const [metalType, setMetalType] = useState('Gold (22K)');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Form states for receiving finished order
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);
  const [finishedWeight, setFinishedWeight] = useState<number>(0);
  const [allowedWastage, setAllowedWastage] = useState<number>(3); // 3%
  const [laborCharge, setLaborCharge] = useState<number>(0);

  // Inline payout confirmation state
  const [payoutConfirmId, setPayoutConfirmId] = useState<string | null>(null);

  const handleIssueWorkOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKarigarId || !designName || !goldIssued || !dueDate) {
      alert("Please fill in all mandatory fields!");
      return;
    }

    const karigar = karigars.find(k => k.id === selectedKarigarId);
    if (!karigar) return;

    const newOrder: WorkOrder = {
      id: `wo-${Date.now()}`,
      orderNo: `WO-2026-00${workOrders.length + 1}`,
      karigarId: selectedKarigarId,
      karigarName: karigar.name,
      designName,
      category,
      goldIssued: Number(goldIssued),
      metalType,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate,
      status: 'In Progress',
      notes
    };

    // Update active orders
    setWorkOrders(prev => [newOrder, ...prev]);

    // Update Karigar's outstanding raw metal balance
    setKarigars(prev => prev.map(k => {
      if (k.id === selectedKarigarId) {
        return {
          ...k,
          metalBalance: Number((k.metalBalance + Number(goldIssued)).toFixed(3))
        };
      }
      return k;
    }));

    // Reset Form
    setSelectedKarigarId('');
    setDesignName('');
    setGoldIssued(0);
    setNotes('');
    setIssueModalOpen(false);
  };

  const handleReceiveOrderDetails = (order: WorkOrder) => {
    setReceivingOrderId(order.id);
    // Suggest estimated labor charge
    setLaborCharge(Math.round(order.goldIssued * 450));
    setFinishedWeight(order.goldIssued);
  };

  const handleCompleteReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingOrderId || !finishedWeight || !laborCharge) return;

    const order = workOrders.find(o => o.id === receivingOrderId);
    if (!order) return;

    // wastage calculation
    const loss = Number((order.goldIssued - Number(finishedWeight)).toFixed(3));
    const allowedWeightLoss = Number((order.goldIssued * (allowedWastage / 100)).toFixed(3));
    
    // Update active orders
    setWorkOrders(prev => prev.map(o => {
      if (o.id === receivingOrderId) {
        return {
          ...o,
          status: 'Completed',
          finishedWeight: Number(finishedWeight),
          actualWastage: loss,
          laborCharge: Number(laborCharge)
        };
      }
      return o;
    }));

    // Update Karigar metal balances and labor payables
    // Net metal returned to workshop = finishedWeight.
    // Gold consumed from artisan balance = finishedWeight + allowed wastage.
    // If they lost more than allowed, they pay/reconcile the excess.
    const goldToDeduct = Number(finishedWeight) + Math.min(loss, allowedWeightLoss);
    
    setKarigars(prev => prev.map(k => {
      if (k.id === order.karigarId) {
        return {
          ...k,
          metalBalance: Number((k.metalBalance - goldToDeduct).toFixed(3)),
          laborChargesOwed: k.laborChargesOwed + Number(laborCharge)
        };
      }
      return k;
    }));

    setReceivingOrderId(null);
  };

  const handlePayoutKarigar = (id: string, amount: number) => {
    setKarigars(prev => prev.map(k => {
      if (k.id === id) {
        return {
          ...k,
          laborChargesOwed: Math.max(0, k.laborChargesOwed - amount)
        };
      }
      return k;
    }));
    setPayoutConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs */}
      <div className="flex border-b border-slate-150 gap-4">
        <button
          onClick={() => setActiveSubTab('artisans')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeSubTab === 'artisans'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Artisans Ledger
        </button>
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeSubTab === 'orders'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Jobwork Orders
        </button>
      </div>

      {activeSubTab === 'artisans' ? (
        /* ARTISANS LEDGER GRID */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {karigars.map((kar) => {
              const activeOrders = workOrders.filter(o => o.karigarId === kar.id && o.status === 'In Progress');
              const completedOrders = workOrders.filter(o => o.karigarId === kar.id && o.status === 'Completed');
              
              return (
                <div 
                  key={kar.id}
                  className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-sans font-bold text-slate-800 text-base">{kar.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">Specialty: {kar.specialty}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold font-mono">
                        Rating: {kar.rating}★
                      </span>
                    </div>
                  </div>

                  {/* Ledger balances */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-100/50">
                      <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider block">Outstanding Metal (g)</span>
                      <span className="font-mono text-base font-black text-amber-800">
                        {kar.metalBalance} grams
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-1">Held by artisan in workshop</span>
                    </div>
                    <div className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                      <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider block">Labor Charges Due</span>
                      <span className="font-mono text-base font-black text-indigo-900">
                        ₹{kar.laborChargesOwed.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-1">Pending approval payout</span>
                    </div>
                  </div>

                  {/* Active & Completed Orders Ledger List */}
                  <div className="border-t border-slate-100 pt-3.5 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">
                        Assigned Jobwork Ledger
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">
                        {activeOrders.length} Active / {completedOrders.length} Completed
                      </span>
                    </div>

                    {activeOrders.length === 0 && completedOrders.length === 0 ? (
                      <div className="p-2.5 bg-slate-50/60 rounded-xl text-center border border-slate-100">
                        <p className="text-[11px] text-slate-400 italic">No jobwork orders registered for this artisan.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {/* Active Orders */}
                        {activeOrders.map(order => (
                          <div 
                            key={order.id} 
                            className="p-2 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 rounded-lg flex justify-between items-center transition"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] font-black text-amber-600 bg-amber-500/10 px-1 rounded">
                                  {order.orderNo}
                                </span>
                                <span className="font-bold text-slate-800 text-[11px] truncate max-w-[120px] md:max-w-[150px]">
                                  {order.designName}
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-400 font-mono uppercase">{order.category} • Due: {order.dueDate}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-mono font-bold text-amber-700">{order.goldIssued.toFixed(3)}g</p>
                              <span className="inline-block text-[8px] font-bold text-amber-600 bg-amber-50 px-1 rounded uppercase tracking-wider scale-95 origin-right">
                                Active
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Completed Orders */}
                        {completedOrders.map(order => (
                          <div 
                            key={order.id} 
                            className="p-2 bg-slate-50 hover:bg-slate-100/75 border border-slate-150/70 rounded-lg flex justify-between items-center transition"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 px-1 rounded">
                                  {order.orderNo}
                                </span>
                                <span className="font-medium text-slate-600 text-[11px] line-through decoration-slate-300 truncate max-w-[120px] md:max-w-[150px]">
                                  {order.designName}
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-400 font-mono uppercase">{order.category}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-mono font-bold text-slate-500">{order.goldIssued.toFixed(3)}g</p>
                              <span className="inline-block text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded uppercase tracking-wider scale-95 origin-right">
                                Finished
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick payout triggers */}
                  {kar.laborChargesOwed > 0 && (
                    <div className="pt-2 flex justify-end">
                      {payoutConfirmId === kar.id ? (
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50">
                          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400">Confirm ₹{kar.laborChargesOwed.toLocaleString('en-IN')}?</span>
                          <button
                            onClick={() => handlePayoutKarigar(kar.id, kar.laborChargesOwed)}
                            className="px-2.5 py-1 text-[11px] font-black bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition cursor-pointer"
                          >
                            Yes, Pay
                          </button>
                          <button
                            onClick={() => setPayoutConfirmId(null)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPayoutConfirmId(kar.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition cursor-pointer"
                        >
                          <Wallet className="w-3.5 h-3.5" /> Clear Labor Payout
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* JOBWORK ORDERS LIST */
        <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
            <h4 className="font-sans font-bold text-slate-800 text-sm">Manufacturing Track List</h4>
            <button
              onClick={() => setIssueModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              <FilePlus className="w-4 h-4" /> Issue New Job
            </button>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-600">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 font-mono font-bold uppercase tracking-wider">
                  <th className="p-4">Order No</th>
                  <th>Artisan</th>
                  <th>Design / Category</th>
                  <th>Gold Issued (g)</th>
                  <th>Standard</th>
                  <th>Target Date</th>
                  <th>Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {workOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/30 transition">
                    <td className="p-4 font-mono font-bold text-slate-900">{order.orderNo}</td>
                    <td>{order.karigarName}</td>
                    <td>
                      <div className="font-bold text-slate-850">{order.designName}</div>
                      <div className="text-[10px] text-slate-400 font-mono uppercase">{order.category}</div>
                    </td>
                    <td className="font-mono text-slate-900 font-semibold">{order.goldIssued.toFixed(3)}g</td>
                    <td className="font-mono text-slate-500">{order.metalType}</td>
                    <td className="font-mono text-slate-500">{order.dueDate}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        order.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {order.status === 'In Progress' && (
                        <button
                          onClick={() => handleReceiveOrderDetails(order)}
                          className="px-2.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition"
                        >
                          Receive Finished
                        </button>
                      )}
                      {order.status === 'Completed' && (
                        <div className="text-[10px] text-slate-400 font-bold">
                          Loss: {order.actualWastage?.toFixed(3)}g
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ISSUE NEW JOBWORK MODAL */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Hammer className="w-5 h-5 text-amber-500" />
                <h3 className="font-sans font-bold text-slate-900 text-base">Issue Jobwork Order</h3>
              </div>
              <button
                onClick={() => setIssueModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueWorkOrder} className="p-6 space-y-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Assign Karigar *</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  value={selectedKarigarId}
                  onChange={(e) => setSelectedKarigarId(e.target.value)}
                >
                  <option value="">-- Choose Artisan --</option>
                  {karigars.map(k => (
                    <option key={k.id} value={k.id}>{k.name} ({k.specialty})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Design Specification *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Classic Bridal Choker - Floral Filigree"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Category</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Rings">Rings</option>
                    <option value="Necklaces">Necklaces</option>
                    <option value="Earrings">Earrings</option>
                    <option value="Bangles">Bangles</option>
                    <option value="Chains">Chains</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Purity Standard</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    value={metalType}
                    onChange={(e) => setMetalType(e.target.value)}
                  >
                    <option value="Gold (22K)">Gold (22K)</option>
                    <option value="Gold (18K)">Gold (18K)</option>
                    <option value="Platinum (950)">Platinum (950)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Pure Gold Issued (g) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none"
                    value={goldIssued || ''}
                    onChange={(e) => setGoldIssued(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Special Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Notes for stone selection or wire design..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIssueModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition"
                >
                  Issue Alloy & Record Work
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE FINISHED WORK DIALOG OVERLAY */}
      {receivingOrderId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="font-sans font-bold text-slate-900 text-base">Reconcile Finished Ornament</h3>
              </div>
              <button
                onClick={() => setReceivingOrderId(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteReceipt} className="p-6 space-y-4 text-xs font-medium">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-0.5">Assigned Job</span>
                <p className="font-bold text-slate-800 text-sm">
                  {workOrders.find(o => o.id === receivingOrderId)?.designName}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Gold Issued: {workOrders.find(o => o.id === receivingOrderId)?.goldIssued.toFixed(3)}g
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Finished Weight (g) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none"
                    value={finishedWeight || ''}
                    onChange={(e) => setFinishedWeight(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Wastage Cap (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none"
                    value={allowedWastage}
                    onChange={(e) => setAllowedWastage(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Artisan Labor Fees (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none"
                  value={laborCharge || ''}
                  onChange={(e) => setLaborCharge(parseFloat(e.target.value) || 0)}
                />
              </div>

              {finishedWeight > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">Metal Reconciliation</span>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Actual Metal Loss:</span>
                    <span className="font-mono text-slate-800 font-bold">
                      {Math.max(0, Number(( (workOrders.find(o => o.id === receivingOrderId)?.goldIssued || 0) - finishedWeight ).toFixed(3)))}g
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReceivingOrderId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition"
                >
                  Confirm Receipt & Update Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
