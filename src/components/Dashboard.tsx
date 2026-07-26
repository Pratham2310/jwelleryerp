import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Receipt, 
  Hammer, 
  UserPlus, 
  Coins, 
  Activity,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Scale
} from 'lucide-react';
import { isSellable } from '../lib/tagStateMachine';
import { Tag, SaleInvoice, Karigar, MetalRate } from '../types';

interface DashboardProps {
  metalRates: MetalRate[];
  setMetalRates: React.Dispatch<React.SetStateAction<MetalRate[]>>;
  tags: Tag[];
  customersCount: number;
  karigars: Karigar[];
  invoices: SaleInvoice[];
  activeWorkOrdersCount: number;
  setActiveTab: (tab: string) => void;
  openAddModal: () => void;
  openIssueOrderModal: () => void;
}

export default function Dashboard({
  metalRates,
  setMetalRates,
  tags,
  customersCount,
  karigars, 
  invoices, 
  activeWorkOrdersCount,
  setActiveTab,
  openAddModal,
  openIssueOrderModal
}: DashboardProps) {
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [tempRate, setTempRate] = useState<string>('');

  // Calculate KPIs. Estimates are non-fiscal quotations (Milestone 11) and are excluded from
  // every revenue figure — only real tax invoices count as sales. Credit notes (Milestone 12)
  // carry negative figures, so including them yields revenue NET of returns.
  const taxInvoices = invoices.filter(inv => inv.invoiceType === 'TAX_INVOICE');
  const fiscalDocuments = invoices.filter(inv => inv.invoiceType === 'TAX_INVOICE' || inv.invoiceType === 'CREDIT_NOTE');
  const totalSalesRevenue = fiscalDocuments.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const totalItemsCount = tags.length;
  const inStockItemsCount = tags.filter(i => isSellable(i.status)).length;
  
  // Calculate total artisan gold balance outstanding
  const totalArtisanGoldOutstanding = karigars.reduce((sum, k) => sum + Math.max(0, k.metalBalance), 0);

  // Metal Rate Updater
  const handleStartEdit = (rate: MetalRate) => {
    setEditingRateId(rate.id);
    setTempRate(rate.ratePerGram.toString());
  };

  const handleSaveRate = (id: string) => {
    const parsed = parseFloat(tempRate);
    if (!isNaN(parsed) && parsed > 0) {
      setMetalRates(prev => prev.map(r => {
        if (r.id === id) {
          const oldRate = r.ratePerGram;
          const pctChange = ((parsed - oldRate) / oldRate) * 100;
          return {
            ...r,
            ratePerGram: parsed,
            change24h: Number(pctChange.toFixed(2)),
            history24h: [...r.history24h.slice(1), parsed]
          };
        }
        return r;
      }));
    }
    setEditingRateId(null);
  };

  // Sparkline generator
  const renderSparkline = (points: number[], colorClass: string) => {
    if (!points || points.length === 0) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 80;
    const height = 28;
    const padding = 2;

    const coordinates = points.map((p, index) => {
      const x = (index / (points.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((p - min) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={colorClass}
          points={coordinates}
        />
      </svg>
    );
  };

  // Category Stock Breakdown Calculator
  const categories = ['Rings', 'Necklaces', 'Earrings', 'Bangles', 'Bracelets', 'Chains', 'Coins'];
  const categoryCounts = categories.map(cat => {
    const count = tags.filter(item => item.category === cat).length;
    const weight = tags.filter(item => item.category === cat).reduce((sum, i) => sum + i.netWeight, 0);
    return { name: cat, count, weight: Number(weight.toFixed(2)) };
  }).filter(c => c.count > 0);

  const totalStockWeight = categoryCounts.reduce((sum, c) => sum + c.weight, 0) || 1;

  // Custom SVG Doughnut Chart Calculation
  let accumulatedPercent = 0;
  const doughnutColors = [
    'stroke-amber-500', 'stroke-amber-400', 'stroke-amber-600', 
    'stroke-slate-700', 'stroke-slate-500', 'stroke-slate-400', 'stroke-slate-300'
  ];

  const doughnutSlices = categoryCounts.map((cat, idx) => {
    const percentage = (cat.weight / totalStockWeight) * 100;
    const strokeDasharray = `${percentage} ${100 - percentage}`;
    const strokeDashoffset = -accumulatedPercent;
    accumulatedPercent += percentage;
    return {
      name: cat.name,
      percentage: Math.round(percentage),
      dashArray: strokeDasharray,
      dashOffset: strokeDashoffset,
      color: doughnutColors[idx % doughnutColors.length]
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner with Local Timestamp */}
      <div className="bg-white border border-slate-150 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 banner-glow-amber rounded-full blur-3xl -z-10" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">Operational Live</span>
            <span className="text-xs text-slate-400 font-medium">BOM-HQ-TERMINAL-01</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Jewellery Hub Headquarters</h2>
          <p className="text-sm text-slate-500">Real-time valuation, metal accounting, making charge tracking, and artisan ledgers.</p>
        </div>

        {/* Dynamic Rates Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition duration-150 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Showcase Item
          </button>
          <button 
            onClick={openIssueOrderModal}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition duration-150 shadow-sm shadow-amber-500/10"
          >
            <Hammer className="w-4 h-4 text-slate-950" /> Issue Artisan Job
          </button>
        </div>
      </div>

      {/* Live Rate Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metalRates.map((rate) => {
          const isEditing = editingRateId === rate.id;
          const isUp = rate.change24h >= 0;
          return (
            <div 
              key={rate.id}
              className="bg-white border border-slate-150 p-4.5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group relative"
            >
              <div className="flex justify-between items-start mb-2.5">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">{rate.metalType}</p>
                  <span className="text-[10px] text-slate-400 font-medium font-mono">Purity: {rate.purity}</span>
                </div>
                {renderSparkline(rate.history24h, isUp ? 'text-emerald-500' : 'text-rose-500')}
              </div>

              {/* Price / Edit Box */}
              <div className="mt-3 flex items-baseline justify-between">
                {isEditing ? (
                  <div className="flex items-center gap-1.5 w-full mt-1">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        className="w-full text-sm font-semibold font-mono pl-6 pr-1 py-1 rounded bg-slate-100 border border-amber-500 focus:outline-none"
                        value={tempRate}
                        onChange={(e) => setTempRate(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRate(rate.id)}
                        autoFocus
                      />
                    </div>
                    <button 
                      onClick={() => handleSaveRate(rate.id)}
                      className="px-2 py-1 text-[10px] font-bold bg-amber-500 text-slate-950 rounded hover:bg-amber-600"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900">₹{rate.ratePerGram.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] font-medium text-slate-400 font-mono">/g</span>
                  </div>
                )}
                
                {!isEditing && (
                  <button 
                    onClick={() => handleStartEdit(rate)}
                    className="text-[10px] font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity hover:underline absolute top-4.5 right-4 bg-amber-50 px-1.5 py-0.5 rounded"
                  >
                    Edit Rate
                  </button>
                )}
              </div>

              {/* Trend Arrow */}
              {!isEditing && (
                <div className="mt-2.5 flex items-center gap-1">
                  {isUp ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  )}
                  <span className={`text-[10px] font-bold font-mono ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isUp ? '+' : ''}{rate.change24h}%
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">last 24h</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 dashboard-card-glow rounded-full blur-2xl dashboard-card-glow-hover transition-all duration-300" />
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono mb-1">Today's Sales Revenue</p>
          <p className="text-2xl font-black font-mono text-amber-400 tracking-tight">₹{totalSalesRevenue.toLocaleString('en-IN')}</p>
          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Completed Bills: {taxInvoices.length}</span>
            <button onClick={() => setActiveTab('billing?tab=history')} className="text-amber-400 hover:underline flex items-center gap-0.5 font-bold cursor-pointer">
              Invoices <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 dashboard-card-glow rounded-full blur-2xl dashboard-card-glow-hover transition-all duration-300" />
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono mb-1">Showcase Inventory</p>
          <p className="text-2xl font-black font-mono text-slate-900 tracking-tight">{inStockItemsCount} <span className="text-xs font-medium text-slate-400">/ {totalItemsCount} items</span></p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">In-Stock Purity Ratio: 91.6%</span>
            <button onClick={() => setActiveTab('catalog')} className="text-amber-600 hover:underline flex items-center gap-0.5 font-bold">
              Catalog <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 dashboard-card-glow rounded-full blur-2xl dashboard-card-glow-hover transition-all duration-300" />
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono mb-1">Active Artisan Jobwork</p>
          <p className="text-2xl font-black font-mono text-slate-900 tracking-tight">{activeWorkOrdersCount} <span className="text-xs font-medium text-slate-400">orders</span></p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Due in next 7 days: 2 jobs</span>
            <button onClick={() => setActiveTab('karigar')} className="text-amber-600 hover:underline flex items-center gap-0.5 font-bold">
              Manufacturing <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 dashboard-card-glow rounded-full blur-2xl dashboard-card-glow-hover transition-all duration-300" />
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono mb-1">Karigar Outstanding Gold</p>
          <p className="text-2xl font-black font-mono text-slate-900 tracking-tight">{totalArtisanGoldOutstanding.toFixed(3)} <span className="text-xs font-medium text-slate-400">g</span></p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Pending accounts: {karigars.length} Karigars</span>
            <button onClick={() => setActiveTab('karigar')} className="text-amber-600 hover:underline flex items-center gap-0.5 font-bold">
              Ledger <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart (2/3 width on large screens) */}
        <div className="bg-white border border-slate-150 p-5.5 rounded-2xl shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-sans font-bold text-slate-800 text-sm">Monthly Sales Revenue Trend</h3>
              <p className="text-xs text-slate-400">Past 6 months cumulative jewelry turnover</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Finished Goods
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 ml-2" /> Old Gold Scrap
            </div>
          </div>

          {/* SVG Custom Line Chart */}
          <div className="h-60 relative w-full flex items-end">
            <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
              {/* Grid Lines */}
              <line x1="40" y1="20" x2="580" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
              <line x1="40" y1="70" x2="580" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
              <line x1="40" y1="120" x2="580" y2="120" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
              <line x1="40" y1="170" x2="580" y2="170" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" />
              <line x1="40" y1="200" x2="580" y2="200" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Y-Axis Labels */}
              <text x="30" y="24" textAnchor="end" className="text-[10px] font-mono font-medium fill-slate-400">₹6L</text>
              <text x="30" y="74" textAnchor="end" className="text-[10px] font-mono font-medium fill-slate-400">₹4L</text>
              <text x="30" y="124" textAnchor="end" className="text-[10px] font-mono font-medium fill-slate-400">₹2L</text>
              <text x="30" y="174" textAnchor="end" className="text-[10px] font-mono font-medium fill-slate-400">₹50K</text>
              <text x="30" y="204" textAnchor="end" className="text-[10px] font-mono font-medium fill-slate-400">₹0</text>

              {/* Chart Line Path */}
              {/* Data points: Feb 120k, Mar 180k, Apr 290k, May 240k, Jun 420k, Jul (today) 510k */}
              {/* x-coords: 70, 160, 250, 340, 430, 520 */}
              {/* y-coords: scale values from 200 (₹0) to 20 (₹6L) */}
              <path
                d="M 70 170 Q 115 155, 160 140 T 250 100 T 340 120 T 430 65 T 520 40"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Area under the path */}
              <path
                d="M 70 170 Q 115 155, 160 140 T 250 100 T 340 120 T 430 65 T 520 40 L 520 200 L 70 200 Z"
                fill="url(#goldGrad)"
                opacity="0.12"
              />

              {/* Dots on points */}
              <circle cx="70" cy="170" r="5" className="fill-amber-600 stroke-white stroke-2 cursor-pointer hover:r-7 transition-all" />
              <circle cx="160" cy="140" r="5" className="fill-amber-600 stroke-white stroke-2 cursor-pointer hover:r-7 transition-all" />
              <circle cx="250" cy="100" r="5" className="fill-amber-600 stroke-white stroke-2 cursor-pointer hover:r-7 transition-all" />
              <circle cx="340" cy="120" r="5" className="fill-amber-600 stroke-white stroke-2 cursor-pointer hover:r-7 transition-all" />
              <circle cx="430" cy="65" r="5" className="fill-amber-600 stroke-white stroke-2 cursor-pointer hover:r-7 transition-all" />
              <circle cx="520" cy="40" r="6" className="fill-slate-900 stroke-amber-500 stroke-2 cursor-pointer hover:r-8 transition-all" />

              {/* Point Values tooltip-like annotations */}
              <text x="70" y="152" textAnchor="middle" className="text-[9px] font-mono font-bold fill-slate-500">1.2L</text>
              <text x="160" y="122" textAnchor="middle" className="text-[9px] font-mono font-bold fill-slate-500">1.8L</text>
              <text x="250" y="82" textAnchor="middle" className="text-[9px] font-mono font-bold fill-slate-500">2.9L</text>
              <text x="340" y="102" textAnchor="middle" className="text-[9px] font-mono font-bold fill-slate-500">2.4L</text>
              <text x="430" y="47" textAnchor="middle" className="text-[9px] font-mono font-bold fill-slate-500">4.2L</text>
              <text x="520" y="22" textAnchor="middle" className="text-[9px] font-mono font-black fill-amber-700 bg-amber-50">₹5.1L</text>

              {/* X-Axis Labels */}
              <text x="70" y="215" textAnchor="middle" className="text-[10px] font-semibold fill-slate-400 uppercase tracking-wider">Feb</text>
              <text x="160" y="215" textAnchor="middle" className="text-[10px] font-semibold fill-slate-400 uppercase tracking-wider">Mar</text>
              <text x="250" y="215" textAnchor="middle" className="text-[10px] font-semibold fill-slate-400 uppercase tracking-wider">Apr</text>
              <text x="340" y="215" textAnchor="middle" className="text-[10px] font-semibold fill-slate-400 uppercase tracking-wider">May</text>
              <text x="430" y="215" textAnchor="middle" className="text-[10px] font-semibold fill-slate-400 uppercase tracking-wider">Jun</text>
              <text x="520" y="215" textAnchor="middle" className="text-[10px] font-black fill-slate-800 uppercase tracking-wider">Jul 20</text>

              {/* Gradient definitions */}
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Stock Category Breakdown Doughnut Chart (1/3 width) */}
        <div className="bg-white border border-slate-150 p-5.5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="font-sans font-bold text-slate-800 text-sm">Stock By Metal Weight</h3>
            <p className="text-xs text-slate-400">Breakdown of gross raw weights in grams</p>
          </div>

          {/* Doughnut SVG */}
          <div className="my-auto py-4 flex flex-col items-center justify-center">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                
                {/* Slices */}
                {doughnutSlices.map((slice, idx) => (
                  <circle
                    key={slice.name}
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    className={`${slice.color} transition-all duration-500 hover:stroke-[3.5] cursor-pointer`}
                    strokeWidth="3.2"
                    strokeDasharray={slice.dashArray}
                    strokeDashoffset={slice.dashOffset}
                  />
                ))}
              </svg>
              {/* Inner Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <Scale className="w-4 h-4 text-amber-500 mb-0.5" />
                <span className="text-sm font-black font-mono text-slate-900">{totalStockWeight.toFixed(1)}g</span>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none">Net Weight</span>
              </div>
            </div>
          </div>

          {/* Legends */}
          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {doughnutSlices.map((slice) => (
                <div key={slice.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`w-2 h-2 rounded-full ${slice.color.replace('stroke', 'bg')}`} />
                    <span className="text-slate-500 font-medium truncate">{slice.name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-700">{slice.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lower Section: Recent activity and system messages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions (Invoices) */}
        <div className="bg-white border border-slate-150 p-5.5 rounded-2xl shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-600" />
              <h3 className="font-sans font-bold text-slate-800 text-sm">Recent Counter Invoices</h3>
            </div>
            <button onClick={() => setActiveTab('billing')} className="text-xs font-bold text-amber-600 hover:underline">
              View All Invoices
            </button>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-mono font-bold uppercase tracking-wider pb-2">
                  <th className="py-2.5">Invoice No</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items Weight</th>
                  <th>Payment</th>
                  <th className="text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {taxInvoices.slice(0, 4).map((inv) => {
                  const itemsWeight = inv.items.reduce((sum, item) => sum + item.netWeight, 0);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td>
                        <div className="font-semibold text-slate-850">{inv.customerName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{inv.customerPhone}</div>
                      </td>
                      <td className="font-mono text-slate-500">{inv.date}</td>
                      <td className="font-mono">{itemsWeight.toFixed(2)} g</td>
                      <td>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="text-right font-mono font-black text-slate-900">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Security and Quick Actions Log */}
        <div className="bg-white border border-slate-150 p-5.5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
            <Activity className="w-5 h-5 text-amber-600" />
            <h3 className="font-sans font-bold text-slate-800 text-sm">ERP Action Log</h3>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3 text-xs leading-relaxed">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-800">Gold (22K) Rate updated to ₹6,650</p>
                <p className="text-[10px] text-slate-400 font-mono">2 mins ago • Operator: Prathamesh</p>
              </div>
            </div>
            <div className="flex gap-3 text-xs leading-relaxed">
              <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-800">Work Order WO-2026-003 Issued</p>
                <p className="text-[10px] text-slate-400 font-mono">35 mins ago • Assigned to Karigar Ramesh</p>
              </div>
            </div>
            <div className="flex gap-3 text-xs leading-relaxed">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-800">Old gold trade-in invoice completed</p>
                <p className="text-[10px] text-slate-400 font-mono">1 hr ago • 5g pure gold credited to counter scrap</p>
              </div>
            </div>
            <div className="flex gap-3 text-xs leading-relaxed">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-800">Monthly Audit Backup Created</p>
                <p className="text-[10px] text-slate-400 font-mono">3 hrs ago • Status: Success</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
