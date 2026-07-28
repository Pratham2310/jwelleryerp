import React, { useState } from 'react';
import {
  Gem,
  Search,
  Plus,
  Sparkles,
  Award,
  UserCheck,
  CheckCircle,
  X,
  Scale,
  Layers,
  ChevronRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { LooseStone, Karigar } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface StoneManagerProps {
  karigars: Karigar[];
  stones: LooseStone[];
  setStones: React.Dispatch<React.SetStateAction<LooseStone[]>>;
}

export default function StoneManager({ karigars, stones, setStones }: StoneManagerProps) {
  const { theme } = useTheme();

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedCut, setSelectedCut] = useState<string>('All');
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isIssueModalOpen, setIssueModalOpen] = useState(false);
  const [activeStoneForIssue, setActiveStoneForIssue] = useState<LooseStone | null>(null);

  // Issue Stone Form state
  const [selectedKarigarName, setSelectedKarigarName] = useState('');

  // Add Stone Form state
  const [newStone, setNewStone] = useState<Partial<LooseStone>>({
    lotNo: '',
    stoneType: 'Diamond',
    cut: 'Round Brilliant',
    color: 'G',
    clarity: 'VVS2',
    caratWeight: 0,
    quantity: 1,
    valuePerCarat: 0,
    certification: 'GIA',
    certificateNo: ''
  });

  // Filters
  const filteredStones = stones.filter(stone => {
    const matchesSearch = 
      stone.lotNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (stone.certificateNo && stone.certificateNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (stone.assignedKarigarName && stone.assignedKarigarName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = selectedType === 'All' || stone.stoneType === selectedType;
    const matchesCut = selectedCut === 'All' || stone.cut === selectedCut;

    return matchesSearch && matchesType && matchesCut;
  });

  // Calculations
  const totalValue = stones.reduce((sum, s) => sum + s.totalValue, 0);
  const totalCarats = stones.reduce((sum, s) => sum + s.caratWeight, 0);
  const issuedCarats = stones.filter(s => s.status === 'Issued').reduce((sum, s) => sum + s.caratWeight, 0);
  const certifiedCount = stones.filter(s => s.certification !== 'None').length;

  const handleAddStone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStone.lotNo || !newStone.caratWeight || !newStone.valuePerCarat) {
      alert('Please fill in Lot Number, Carat Weight, and Value per Carat.');
      return;
    }

    const value = Number(newStone.caratWeight) * Number(newStone.valuePerCarat);
    const added: LooseStone = {
      id: `stone-${Date.now()}`,
      lotNo: newStone.lotNo,
      stoneType: newStone.stoneType as any,
      cut: newStone.cut as any,
      color: newStone.color || 'N/A',
      clarity: newStone.clarity || 'N/A',
      caratWeight: Number(newStone.caratWeight),
      quantity: Number(newStone.quantity || 1),
      valuePerCarat: Number(newStone.valuePerCarat),
      totalValue: value,
      certification: newStone.certification as any,
      certificateNo: newStone.certification !== 'None' ? newStone.certificateNo : undefined,
      status: 'In Vault'
    };

    setStones(prev => [added, ...prev]);
    setAddModalOpen(false);
    
    // Reset form
    setNewStone({
      lotNo: '',
      stoneType: 'Diamond',
      cut: 'Round Brilliant',
      color: 'G',
      clarity: 'VVS2',
      caratWeight: 0,
      quantity: 1,
      valuePerCarat: 0,
      certification: 'GIA',
      certificateNo: ''
    });
  };

  const handleOpenIssueModal = (stone: LooseStone) => {
    setActiveStoneForIssue(stone);
    setSelectedKarigarName(karigars[0]?.name || '');
    setIssueModalOpen(true);
  };

  const handleIssueStone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStoneForIssue || !selectedKarigarName) return;

    setStones(prev => prev.map(s => {
      if (s.id === activeStoneForIssue.id) {
        return {
          ...s,
          status: 'Issued',
          assignedKarigarName: selectedKarigarName
        };
      }
      return s;
    }));

    setIssueModalOpen(false);
    setActiveStoneForIssue(null);
  };

  const handleReturnToVault = (stoneId: string) => {
    setStones(prev => prev.map(s => {
      if (s.id === stoneId) {
        return {
          ...s,
          status: 'In Vault',
          assignedKarigarName: undefined
        };
      }
      return s;
    }));
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Title Banner */}
      <div className="bg-[#141416] border border-[#262626] p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#C5A059]/10 text-[#C5A059] uppercase tracking-wider border border-[#C5A059]/20">
              Stone Ledger Active
            </span>
            <span className="text-[10px] text-zinc-500 font-mono font-bold">VAULT-STN-902</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Stones & Diamonds Ledger</h2>
          <p className="text-xs text-zinc-400">Track raw diamond parcels, precious stone lots, certifications, and active artisan checkouts.</p>
        </div>

        <button 
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 bg-[#C5A059] hover:bg-[#D9B875] text-[#0A0A0B] font-bold text-xs px-4 py-2.5 rounded-xl transition duration-150 shadow-lg shadow-[#C5A059]/10"
        >
          <Plus className="w-4 h-4 text-[#0A0A0B] stroke-[3px]" /> Inward Loose Stone Lot
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#141416] border border-[#262626] p-4.5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-[#C5A059] group-hover:opacity-10 transition-opacity">
            <Gem className="w-16 h-16" />
          </div>
          <p className="text-[10px] font-mono tracking-wider text-zinc-500 uppercase font-bold">Total Valuation</p>
          <h3 className="text-2xl font-black text-white mt-1.5 font-mono">
            ₹{totalValue.toLocaleString('en-IN')}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-[#C5A059]">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Based on current carat index</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#141416] border border-[#262626] p-4.5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-[#C5A059] group-hover:opacity-10 transition-opacity">
            <Scale className="w-16 h-16" />
          </div>
          <p className="text-[10px] font-mono tracking-wider text-zinc-500 uppercase font-bold">Vault Weight</p>
          <h3 className="text-2xl font-black text-white mt-1.5 font-mono">
            {totalCarats.toFixed(2)} <span className="text-xs text-zinc-500 font-sans">Carats</span>
          </h3>
          <p className="text-[11px] text-zinc-500 mt-2 font-medium">
            Across {stones.length} loose parcels
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#141416] border border-[#262626] p-4.5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-[#C5A059] group-hover:opacity-10 transition-opacity">
            <UserCheck className="w-16 h-16" />
          </div>
          <p className="text-[10px] font-mono tracking-wider text-zinc-500 uppercase font-bold">Issued to Artisans</p>
          <h3 className="text-2xl font-black text-[#C5A059] mt-1.5 font-mono">
            {issuedCarats.toFixed(2)} <span className="text-xs text-[#C5A059]/70 font-sans">Carats</span>
          </h3>
          <p className="text-[11px] text-zinc-500 mt-2 font-medium">
            Checked out for setting work
          </p>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#141416] border border-[#262626] p-4.5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-[#C5A059] group-hover:opacity-10 transition-opacity">
            <Award className="w-16 h-16" />
          </div>
          <p className="text-[10px] font-mono tracking-wider text-zinc-500 uppercase font-bold">Certified Rate</p>
          <h3 className="text-2xl font-black text-white mt-1.5 font-mono">
            {stones.length > 0 ? Math.round((certifiedCount / stones.length) * 100) : 0}%
          </h3>
          <p className="text-[11px] text-zinc-500 mt-2 font-medium">
            {certifiedCount} of {stones.length} lots certified
          </p>
        </div>
      </div>

      {/* Main Ledger Content */}
      <div className="bg-[#141416] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
        {/* Table Controls */}
        <div className="p-5 border-b border-[#262626] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#18181B]/40">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:max-w-xl">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search Lot #, certificate or artisan..."
                className="w-full bg-[#1C1917]/70 border border-[#262626] pl-10 pr-4 py-2 rounded-xl text-xs font-semibold text-white placeholder-zinc-500 focus:outline-none focus:border-[#C5A059] transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Type Filter */}
            <select
              className="bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-[#C5A059]"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Diamond">Diamonds</option>
              <option value="Ruby">Rubies</option>
              <option value="Emerald">Emeralds</option>
              <option value="Sapphire">Sapphires</option>
              <option value="Pearl">Pearls</option>
              <option value="Opal">Opals</option>
            </select>

            {/* Cut Filter */}
            <select
              className="bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-[#C5A059]"
              value={selectedCut}
              onChange={(e) => setSelectedCut(e.target.value)}
            >
              <option value="All">All Cuts</option>
              <option value="Round Brilliant">Round Brilliant</option>
              <option value="Oval">Oval</option>
              <option value="Marquise">Marquise</option>
              <option value="Emerald">Emerald Cut</option>
              <option value="Pear">Pear</option>
              <option value="Princess">Princess</option>
              <option value="Cushion">Cushion</option>
            </select>
          </div>

          <div className="text-[11px] font-mono text-zinc-500 font-bold">
            Showing {filteredStones.length} of {stones.length} stone lots
          </div>
        </div>

        {/* Stones Table */}
        <div className="overflow-x-auto">
          {filteredStones.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Gem className="w-12 h-12 text-zinc-700 mx-auto stroke-[1.2]" />
              <p className="text-zinc-500 text-sm font-semibold">No stones found matching filters.</p>
              <button 
                onClick={() => { setSearchTerm(''); setSelectedType('All'); setSelectedCut('All'); }}
                className="text-[#C5A059] text-xs font-bold underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#262626] text-[10px] uppercase font-bold text-zinc-500 font-mono bg-[#18181B]/20">
                  <th className="py-4 px-5">Lot No & Type</th>
                  <th className="py-4 px-5">Cut Shape</th>
                  <th className="py-4 px-5">Color & Clarity</th>
                  <th className="py-4 px-5 text-right">Carats (Qty)</th>
                  <th className="py-4 px-5 text-right">Rate/Carat</th>
                  <th className="py-4 px-5 text-right">Est. Total</th>
                  <th className="py-4 px-5">Certification</th>
                  <th className="py-4 px-5">Status / Assignment</th>
                  <th className="py-4 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626] text-xs font-semibold text-zinc-300">
                {filteredStones.map((stone) => (
                  <tr key={stone.id} className="hover:bg-[#1C1917]/30 transition-colors group">
                    {/* Lot & Type */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#C5A059]/10 flex items-center justify-center border border-[#C5A059]/20">
                          <Gem className="w-4 h-4 text-[#C5A059]" />
                        </div>
                        <div>
                          <p className="text-white font-mono font-bold">{stone.lotNo}</p>
                          <span className="text-[10px] text-[#C5A059]">{stone.stoneType}</span>
                        </div>
                      </div>
                    </td>

                    {/* Cut */}
                    <td className="py-4 px-5 font-medium">{stone.cut}</td>

                    {/* Color/Clarity */}
                    <td className="py-4 px-5">
                      <p className="text-zinc-200">{stone.color}</p>
                      <span className="text-[10px] text-zinc-500 font-mono uppercase">{stone.clarity}</span>
                    </td>

                    {/* Carat & Qty */}
                    <td className="py-4 px-5 text-right font-mono font-bold">
                      <span className="text-white">{stone.caratWeight.toFixed(2)} ct</span>
                      <p className="text-[10px] text-zinc-500 font-sans">({stone.quantity} pcs)</p>
                    </td>

                    {/* Rate per Carat */}
                    <td className="py-4 px-5 text-right font-mono font-medium text-zinc-400">
                      ₹{stone.valuePerCarat.toLocaleString('en-IN')}
                    </td>

                    {/* Total Value */}
                    <td className="py-4 px-5 text-right font-mono font-bold text-[#C5A059]">
                      ₹{stone.totalValue.toLocaleString('en-IN')}
                    </td>

                    {/* Certification */}
                    <td className="py-4 px-5">
                      {stone.certification !== 'None' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[9px] font-mono font-bold text-zinc-800 dark:text-zinc-200">
                            {stone.certification}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 max-w-[80px] truncate" title={stone.certificateNo}>
                            {stone.certificateNo || 'Pending'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-[10px]">Uncertified</span>
                      )}
                    </td>

                    {/* Status & Artisan */}
                    <td className="py-4 px-5">
                      {/* These badges were authored for a dark row; on the white light-mode row the
                          400-weight text drops to ~1.9:1. Light-first colours with dark: overrides.
                          The amber text is an arbitrary value because index.css remaps text-amber-* to gold. */}
                      {stone.status === 'In Vault' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 dark:border-emerald-500/20 text-[10px]">
                          In Vault
                        </span>
                      ) : stone.status === 'Issued' ? (
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[#8C6D34] dark:text-[#C5A059] border border-amber-500/30 dark:border-amber-500/20 text-[10px]">
                            Issued
                          </span>
                          <p className="text-[9px] text-zinc-400 max-w-[150px] truncate" title={stone.assignedKarigarName}>
                            Artisan: {stone.assignedKarigarName}
                          </p>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 border border-zinc-300 dark:border-zinc-700 text-[10px]">
                          Sold
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {stone.status === 'In Vault' ? (
                          <button
                            onClick={() => handleOpenIssueModal(stone)}
                            className="bg-transparent hover:bg-[#C5A059] border border-[#C5A059]/40 hover:border-transparent text-[#C5A059] hover:text-[#0A0A0B] text-[10px] font-bold px-2.5 py-1 rounded-md transition duration-150"
                          >
                            Issue to Karigar
                          </button>
                        ) : stone.status === 'Issued' ? (
                          <button
                            onClick={() => handleReturnToVault(stone.id)}
                            className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 text-[10px] font-bold px-2.5 py-1 rounded-md transition duration-150"
                          >
                            Return to Vault
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-600">No Action</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: INWARD NEW STONES */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-[#0A0A0B]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-8 border transition-all duration-200 ${
            theme === 'light' ? 'bg-white border-zinc-200' : 'bg-[#141416] border-[#262626]'
          }`}>
            <div className={`p-6 border-b flex justify-between items-center transition-colors duration-200 ${
              theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'border-[#262626] bg-[#18181B]/50'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors duration-200 ${
                  theme === 'light' ? 'bg-[#C5A059]/10 border-[#C5A059]/30 text-[#8C6D34]' : 'bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]'
                }`}>
                  <Gem className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm transition-colors duration-200 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Inward Stone Lot</h3>
                  <p className={`text-[10px] transition-colors duration-200 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Record raw gemstones or solitaires added to showroom stock</p>
                </div>
              </div>
              <button 
                onClick={() => setAddModalOpen(false)}
                className={`p-1.5 rounded-lg transition-colors duration-200 ${
                  theme === 'light' ? 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800' : 'hover:bg-[#262626] text-zinc-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStone} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Lot Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Lot Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DIA-LOT-405"
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-[#C5A059]"
                    value={newStone.lotNo}
                    onChange={(e) => setNewStone(prev => ({ ...prev, lotNo: e.target.value }))}
                  />
                </div>

                {/* Stone Type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Gem Type</label>
                  <select
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-[#C5A059]"
                    value={newStone.stoneType}
                    onChange={(e) => setNewStone(prev => ({ ...prev, stoneType: e.target.value as any }))}
                  >
                    <option value="Diamond">Diamond</option>
                    <option value="Ruby">Ruby</option>
                    <option value="Emerald">Emerald</option>
                    <option value="Sapphire">Sapphire</option>
                    <option value="Pearl">Pearl</option>
                    <option value="Opal">Opal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Cut Shape */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Cut Shape</label>
                  <select
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-[#C5A059]"
                    value={newStone.cut}
                    onChange={(e) => setNewStone(prev => ({ ...prev, cut: e.target.value as any }))}
                  >
                    <option value="Round Brilliant">Round Brilliant</option>
                    <option value="Oval">Oval</option>
                    <option value="Marquise">Marquise</option>
                    <option value="Emerald">Emerald Cut</option>
                    <option value="Pear">Pear</option>
                    <option value="Princess">Princess</option>
                    <option value="Cushion">Cushion</option>
                  </select>
                </div>

                {/* Certification */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Certification</label>
                  <select
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-[#C5A059]"
                    value={newStone.certification}
                    onChange={(e) => setNewStone(prev => ({ ...prev, certification: e.target.value as any }))}
                  >
                    <option value="GIA">GIA</option>
                    <option value="IGI">IGI</option>
                    <option value="HRD">HRD</option>
                    <option value="SGL">SGL</option>
                    <option value="None">None (Uncertified)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Color */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Color Grade</label>
                  <input
                    type="text"
                    placeholder="e.g. G or Pigeon Blood Red"
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-[#C5A059]"
                    value={newStone.color}
                    onChange={(e) => setNewStone(prev => ({ ...prev, color: e.target.value }))}
                  />
                </div>

                {/* Clarity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Clarity Grade</label>
                  <input
                    type="text"
                    placeholder="e.g. VVS2 or Eye-Clean"
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-[#C5A059]"
                    value={newStone.clarity}
                    onChange={(e) => setNewStone(prev => ({ ...prev, clarity: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Carat Weight */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Carat Weight *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-[#C5A059]"
                    value={newStone.caratWeight || ''}
                    onChange={(e) => setNewStone(prev => ({ ...prev, caratWeight: parseFloat(e.target.value) }))}
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Qty (Pieces)</label>
                  <input
                    type="number"
                    required
                    placeholder="1"
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-[#C5A059]"
                    value={newStone.quantity || ''}
                    onChange={(e) => setNewStone(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                  />
                </div>

                {/* Value Per Carat */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Rate / Carat *</label>
                  <input
                    type="number"
                    required
                    placeholder="₹"
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-[#C5A059]"
                    value={newStone.valuePerCarat || ''}
                    onChange={(e) => setNewStone(prev => ({ ...prev, valuePerCarat: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Certificate No */}
              {newStone.certification !== 'None' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Certificate Number</label>
                  <input
                    type="text"
                    placeholder="e.g. GIA-12938471"
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-[#C5A059]"
                    value={newStone.certificateNo}
                    onChange={(e) => setNewStone(prev => ({ ...prev, certificateNo: e.target.value }))}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className={`flex gap-3 pt-4 border-t ${theme === 'light' ? 'border-zinc-200' : 'border-[#262626]'}`}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className={`flex-1 font-bold text-xs py-3 rounded-xl transition border ${
                    theme === 'light' 
                      ? 'bg-transparent border-zinc-200 hover:bg-zinc-50 text-zinc-700' 
                      : 'bg-transparent hover:bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#C5A059] hover:bg-[#D9B875] text-[#0A0A0B] font-bold text-xs py-3 rounded-xl transition shadow-lg shadow-[#C5A059]/10"
                >
                  Inward to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ISSUE STONE TO ARTISAN */}
      {isIssueModalOpen && activeStoneForIssue && (
        <div className="fixed inset-0 bg-[#0A0A0B]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border transition-all duration-200 ${
            theme === 'light' ? 'bg-white border-zinc-200' : 'bg-[#141416] border-[#262626]'
          }`}>
            <div className={`p-6 border-b flex justify-between items-center transition-colors duration-200 ${
              theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'border-[#262626] bg-[#18181B]/50'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors duration-200 ${
                  theme === 'light' ? 'bg-[#C5A059]/10 border-[#C5A059]/30 text-[#8C6D34]' : 'bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]'
                }`}>
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm transition-colors duration-200 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>Issue Stone to Artisan</h3>
                  <p className={`text-[10px] transition-colors duration-200 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Assign precious stone stock to manufacturing job</p>
                </div>
              </div>
              <button 
                onClick={() => setIssueModalOpen(false)}
                className={`p-1.5 rounded-lg transition-colors duration-200 ${
                  theme === 'light' ? 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800' : 'hover:bg-[#262626] text-zinc-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueStone} className="p-6 space-y-4">
              <div className="bg-[#1C1917]/70 p-4 rounded-xl border border-[#262626] space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase text-zinc-500">Lot Ref:</span>
                  <span className={`text-xs font-mono font-bold transition-colors ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{activeStoneForIssue.lotNo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase text-zinc-500">Gem Details:</span>
                  <span className="text-xs font-bold text-[#C5A059]">{activeStoneForIssue.stoneType} ({activeStoneForIssue.cut})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase text-zinc-500">Carat Weight:</span>
                  <span className={`text-xs font-bold transition-colors ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>{activeStoneForIssue.caratWeight.toFixed(2)} Carats</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase text-zinc-500">Estimated Value:</span>
                  <span className="text-xs font-mono font-bold text-[#C5A059]">₹{activeStoneForIssue.totalValue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">Select Karigar / Artisan</label>
                {karigars.length === 0 ? (
                  <p className="text-xs text-rose-400">No active Karigars registered in the system!</p>
                ) : (
                  <select
                    className="w-full bg-[#1C1917]/70 border border-[#262626] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-[#C5A059]"
                    value={selectedKarigarName}
                    onChange={(e) => setSelectedKarigarName(e.target.value)}
                  >
                    {karigars.map(k => (
                      <option key={k.id} value={k.name}>{k.name} ({k.specialty})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Action Buttons */}
              <div className={`flex gap-3 pt-4 border-t ${theme === 'light' ? 'border-zinc-200' : 'border-[#262626]'}`}>
                <button
                  type="button"
                  onClick={() => setIssueModalOpen(false)}
                  className={`flex-1 font-bold text-xs py-3 rounded-xl transition border ${
                    theme === 'light' 
                      ? 'bg-transparent border-zinc-200 hover:bg-zinc-50 text-zinc-700' 
                      : 'bg-transparent hover:bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={karigars.length === 0}
                  className="flex-1 bg-[#C5A059] hover:bg-[#D9B875] disabled:bg-zinc-800 disabled:text-zinc-600 text-[#0A0A0B] font-bold text-xs py-3 rounded-xl transition shadow-lg shadow-[#C5A059]/10"
                >
                  Confirm Checkout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
