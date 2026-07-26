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
  Scale,
  Gem,
  Layers
} from 'lucide-react';
import { isSellable } from '../lib/tagStateMachine';
import {
  monthlyRevenueTrend,
  buildTrendGeometry,
  formatCompactINR,
  buildActivityFeed,
} from '../lib/dashboardAnalytics';
import { Tag, SaleInvoice, Karigar, MetalRate, JobBag, LooseStone } from '../types';

interface DashboardProps {
  metalRates: MetalRate[];
  setMetalRates: React.Dispatch<React.SetStateAction<MetalRate[]>>;
  tags: Tag[];
  customersCount: number;
  karigars: Karigar[];
  invoices: SaleInvoice[];
  // Lifted to App.tsx back in Milestone 1 but never consumed here until Milestone 13
  jobBags: JobBag[];
  stones: LooseStone[];
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
  jobBags,
  stones,
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

  // Real monthly revenue trend, replacing the hardcoded SVG coordinates (Milestone 13)
  const revenueTrend = monthlyRevenueTrend(invoices, 6);
  const trend = buildTrendGeometry(revenueTrend, {
    width: 600, height: 220, padLeft: 46, padRight: 20, padTop: 24, padBottom: 26,
  });
  const latestMonthRevenue = revenueTrend[revenueTrend.length - 1]?.revenue ?? 0;
  const previousMonthRevenue = revenueTrend[revenueTrend.length - 2]?.revenue ?? 0;
  const trendPctChange = previousMonthRevenue > 0
    ? ((latestMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
    : null;

  // Real activity feed, replacing the static hardcoded list (Milestone 13)
  const activityFeed = buildActivityFeed(invoices, tags, jobBags, stones, 6);

  // Stone vault + job-bag KPIs. This state has been lifted to App.tsx since Milestone 1 but
  // was never displayed anywhere on the Dashboard.
  const vaultCarats = stones.reduce((sum, s) => sum + s.caratWeight, 0);
  const vaultValue = stones.reduce((sum, s) => sum + s.totalValue, 0);
  const stonesIssuedCount = stones.filter(s => s.status === 'Issued').length;
  const activeJobBags = jobBags.filter(b => b.currentStage !== 'Completed');
  const jobBagMetalInProduction = activeJobBags.reduce((sum, b) => sum + b.metalIssuedWeight, 0);
  const urgentJobBags = activeJobBags.filter(b => b.priority === 'Urgent' || b.priority === 'Express').length;

  const ACTIVITY_DOT: Record<string, string> = {
    sale: 'bg-emerald-500',
    credit_note: 'bg-rose-500',
    estimate: 'bg-amber-500',
    jobbag: 'bg-indigo-500',
    stone: 'bg-purple-500',
    stock: 'bg-slate-400',
  };

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

      {/* Stone vault & production KPIs — this state has been lifted to App.tsx since Milestone 1
          but was never surfaced on the Dashboard until Milestone 13. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 dashboard-card-glow rounded-full blur-2xl dashboard-card-glow-hover transition-all duration-300" />
          <div className="flex items-center gap-2 mb-1">
            <Gem className="w-3.5 h-3.5 text-purple-500" />
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Stone Vault Holdings</p>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 tracking-tight">
            {vaultCarats.toFixed(2)} <span className="text-xs font-medium text-slate-400">ct</span>
            <span className="text-sm font-bold text-slate-500 ml-2">₹{vaultValue.toLocaleString('en-IN')}</span>
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">
              {stones.length} lots · {stonesIssuedCount} issued to karigars
            </span>
            <button onClick={() => setActiveTab('stones')} className="text-amber-600 hover:underline flex items-center gap-0.5 font-bold">
              Vault <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 dashboard-card-glow rounded-full blur-2xl dashboard-card-glow-hover transition-all duration-300" />
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Metal On Factory Floor</p>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 tracking-tight">
            {jobBagMetalInProduction.toFixed(3)} <span className="text-xs font-medium text-slate-400">g</span>
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">
              {activeJobBags.length} active bags{urgentJobBags > 0 ? ` · ${urgentJobBags} urgent` : ''}
            </span>
            <button onClick={() => setActiveTab('jobbags')} className="text-amber-600 hover:underline flex items-center gap-0.5 font-bold">
              Job Bags <ChevronRight className="w-3 h-3" />
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
              <p className="text-xs text-slate-400">Last 6 months, net of returns — excludes estimates</p>
            </div>
            {trendPctChange !== null && (
              <div className={`flex items-center gap-1 text-xs font-bold ${trendPctChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trendPctChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {trendPctChange >= 0 ? '+' : ''}{trendPctChange.toFixed(1)}% vs last month
              </div>
            )}
          </div>

          {/* SVG line chart, plotted from real invoice data via buildTrendGeometry() */}
          <div className="h-60 relative w-full flex items-end">
            <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
              {/* Gridlines + Y-axis, both derived from the actual data range */}
              {trend.yTicks.map((tick, i) => (
                <g key={`tick-${i}`}>
                  <line
                    x1="46" y1={tick.y} x2="580" y2={tick.y}
                    stroke={i === 0 ? '#e2e8f0' : '#f1f5f9'}
                    strokeWidth={i === 0 ? 1.5 : 1}
                    strokeDasharray={i === 0 ? undefined : '3'}
                  />
                  <text x="38" y={tick.y + 4} textAnchor="end" className="text-[10px] font-mono font-medium fill-slate-400">
                    {formatCompactINR(tick.value)}
                  </text>
                </g>
              ))}

              {/* Area under the line */}
              <path d={trend.areaPath} fill="url(#goldGrad)" opacity="0.12" />

              {/* Trend line */}
              <path d={trend.linePath} fill="none" stroke="#D4AF37" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Points, values and month labels */}
              {trend.points.map((p, i) => {
                const isLatest = i === trend.points.length - 1;
                return (
                  <g key={`pt-${i}`}>
                    <circle
                      cx={p.x} cy={p.y} r={isLatest ? 6 : 5}
                      className={isLatest
                        ? 'fill-slate-900 stroke-amber-500 stroke-2'
                        : 'fill-amber-600 stroke-white stroke-2'}
                    />
                    {/* SVG `fill-*` utilities are NOT covered by index.css's dark-mode repaint
                        (which only remaps `text-*`), so both themes need a colour that reads on
                        either — amber doubles as the "current month" accent. KNOWN_ISSUES #12. */}
                    <text
                      x={p.x} y={p.y - 12} textAnchor="middle"
                      className={isLatest
                        ? 'text-[9px] font-mono font-black fill-amber-500'
                        : 'text-[9px] font-mono font-bold fill-slate-500'}
                    >
                      {p.value === 0 ? '' : formatCompactINR(p.value)}
                    </text>
                    <text
                      x={p.x} y="214" textAnchor="middle"
                      className={isLatest
                        ? 'text-[10px] font-black fill-amber-500 uppercase tracking-wider'
                        : 'text-[10px] font-semibold fill-slate-400 uppercase tracking-wider'}
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}

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
            <h3 className="font-sans font-bold text-slate-800 text-sm">Recent Activity</h3>
          </div>

          {/* Derived from real state (Milestone 13). Replaces four hardcoded entries that
              described events which had never actually happened. */}
          {activityFeed.length === 0 ? (
            <div className="py-8 text-center">
              <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">No activity yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Bill a sale, issue a job bag, or process a return and it will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activityFeed.map(event => (
                <div key={event.id} className="flex gap-3 text-xs leading-relaxed">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ACTIVITY_DOT[event.kind] || 'bg-slate-400'}`} />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{event.title}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      {event.detail}{event.date ? ` • ${event.date}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
