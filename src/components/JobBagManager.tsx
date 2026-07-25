import React, { useState } from 'react';
import {
  Layers,
  Search,
  Plus,
  Sparkles,
  Clock,
  UserCheck,
  CheckCircle2,
  X,
  Scale,
  Award,
  Printer,
  ArrowRight,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { JobBag, Karigar } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { TagQRCode } from './ui/TagCode';

interface JobBagManagerProps {
  karigars: Karigar[];
  jobBags: JobBag[];
  setJobBags: React.Dispatch<React.SetStateAction<JobBag[]>>;
}

export default function JobBagManager({ karigars, jobBags: bags, setJobBags: setBags }: JobBagManagerProps) {
  const { theme } = useTheme();

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isAdvanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [activeBagForAdvance, setActiveBagForAdvance] = useState<JobBag | null>(null);
  const [isTagPreviewOpen, setTagPreviewOpen] = useState(false);
  const [activeBagForTag, setActiveBagForTag] = useState<JobBag | null>(null);

  // Advance Stage Form state
  const [stageLoss, setStageLoss] = useState<number>(0);

  // Add Job Bag Form state
  const [newBag, setNewBag] = useState<Partial<JobBag>>({
    clientName: '',
    designName: '',
    metalType: 'Gold (22K)',
    metalIssuedWeight: 0,
    stonesIssued: 'None',
    assignedKarigarName: '',
    dueDate: '',
    priority: 'Normal',
    notes: ''
  });

  // Stages definition
  const stages: JobBag['currentStage'][] = ['Casting', 'Filing', 'Setting', 'Polishing', 'Hallmark', 'Completed'];

  // Calculations
  const totalBags = bags.length;
  const urgentCount = bags.filter(b => b.priority === 'Urgent' || b.priority === 'Express').length;
  const averageLoss = bags.reduce((sum, b) => sum + b.metalLossRecorded, 0) / (bags.filter(b => b.metalLossRecorded > 0).length || 1);
  const totalWeightInProduction = bags.filter(b => b.currentStage !== 'Completed').reduce((sum, b) => sum + b.metalIssuedWeight, 0);

  const handleLaunchBag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBag.clientName || !newBag.designName || !newBag.metalIssuedWeight || !newBag.dueDate || !newBag.assignedKarigarName) {
      alert('Please fill in all required fields.');
      return;
    }

    const added: JobBag = {
      id: `bag-${Date.now()}`,
      bagNo: `BAG-2026-9${String(bags.length + 1).padStart(2, '0')}`,
      clientName: newBag.clientName,
      designName: newBag.designName,
      currentStage: 'Casting',
      priority: newBag.priority as any,
      metalType: newBag.metalType || 'Gold (22K)',
      metalIssuedWeight: Number(newBag.metalIssuedWeight),
      stonesIssued: newBag.stonesIssued || 'None',
      assignedKarigarName: newBag.assignedKarigarName,
      dueDate: newBag.dueDate,
      notes: newBag.notes || '',
      metalLossRecorded: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setBags(prev => [added, ...prev]);
    setAddModalOpen(false);

    // Reset Form
    setNewBag({
      clientName: '',
      designName: '',
      metalType: 'Gold (22K)',
      metalIssuedWeight: 0,
      stonesIssued: 'None',
      assignedKarigarName: '',
      dueDate: '',
      priority: 'Normal',
      notes: ''
    });
  };

  const handleOpenAdvanceModal = (bag: JobBag) => {
    setActiveBagForAdvance(bag);
    setStageLoss(0);
    setAdvanceModalOpen(true);
  };

  const handleAdvanceStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBagForAdvance) return;

    const currentIdx = stages.indexOf(activeBagForAdvance.currentStage);
    if (currentIdx === stages.length - 1) return; // Already completed

    const nextStage = stages[currentIdx + 1];

    setBags(prev => prev.map(b => {
      if (b.id === activeBagForAdvance.id) {
        return {
          ...b,
          currentStage: nextStage,
          metalLossRecorded: Number((b.metalLossRecorded + Number(stageLoss)).toFixed(3))
        };
      }
      return b;
    }));

    setAdvanceModalOpen(false);
    setActiveBagForAdvance(null);
  };

  const handleOpenTagPreview = (bag: JobBag) => {
    setActiveBagForTag(bag);
    setTagPreviewOpen(true);
  };

  // Filter bags
  const filteredBags = bags.filter(bag => {
    const matchesSearch = 
      bag.bagNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bag.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bag.designName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bag.assignedKarigarName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPriority = selectedPriority === 'All' || bag.priority === selectedPriority;

    return matchesSearch && matchesPriority;
  });

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Urgent': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20';
      case 'Express': return 'bg-amber-50 text-amber-850 border-amber-200 dark:bg-[#C5A059]/15 dark:text-[#D9B875] dark:border-[#C5A059]/30';
      default: return 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800/40 dark:text-zinc-400 dark:border-[#262626]';
    }
  };

  const getStageHeaderColor = (stage: string) => {
    switch (stage) {
      case 'Casting': return 'text-sky-700 bg-sky-50 border-sky-100 dark:text-sky-400 dark:border-sky-500/20 dark:bg-sky-500/5';
      case 'Filing': return 'text-indigo-700 bg-indigo-50 border-indigo-100 dark:text-indigo-400 dark:border-indigo-500/20 dark:bg-indigo-500/5';
      case 'Setting': return 'text-violet-700 bg-violet-50 border-violet-100 dark:text-violet-400 dark:border-violet-500/20 dark:bg-violet-500/5';
      case 'Polishing': return 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-100 dark:text-fuchsia-400 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/5';
      case 'Hallmark': return 'text-rose-700 bg-rose-50 border-rose-100 dark:text-rose-400 dark:border-rose-500/20 dark:bg-rose-500/5';
      default: return 'text-emerald-700 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/5';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Title Banner */}
      <div className={`p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl border ${
        theme === 'light'
          ? 'bg-stone-900 border-stone-850 text-white'
          : 'bg-[#141416] border-[#262626] text-white'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
              theme === 'light'
                ? 'bg-[#C5A059]/20 text-[#D9B875] border-[#C5A059]/30'
                : 'bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/20'
            }`}>
              Manufacturing Pipelines
            </span>
            <span className={`text-[10px] font-mono font-bold ${theme === 'light' ? 'text-[#C5A059]' : 'text-zinc-500'}`}>STITCH-PROD-FLOW</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Job Bags Workflow</h2>
          <p className={`text-xs ${theme === 'light' ? 'text-stone-300' : 'text-zinc-400'}`}>
            Track raw gold castings, assembly, setting, and QC polishing steps with stage loss logs.
          </p>
        </div>

        <button 
          onClick={() => setAddModalOpen(true)}
          className={`flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition duration-150 shadow-lg cursor-pointer bg-[#C5A059] hover:bg-[#D9B875] text-[#0A0A0B] shadow-[#C5A059]/10`}
        >
          <Plus className="w-4 h-4 stroke-[3px]" /> Launch New Job Bag
        </button>
      </div>

      {/* Production Analytics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className={`p-4.5 rounded-2xl relative overflow-hidden group border transition duration-150 ${
          theme === 'light'
            ? 'bg-white border-stone-200 shadow-sm shadow-stone-100/50'
            : 'bg-[#141416] border-[#262626]'
        }`}>
          <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${theme === 'light' ? 'text-[#C5A059]' : 'text-zinc-500'}`}>
            <Layers className="w-16 h-16" />
          </div>
          <p className={`text-[10px] font-mono tracking-wider uppercase font-bold ${theme === 'light' ? 'text-stone-500' : 'text-zinc-500'}`}>Total Active Bags</p>
          <h3 className={`text-2xl font-black mt-1.5 font-mono ${theme === 'light' ? 'text-stone-900' : 'text-white'}`}>
            {bags.filter(b => b.currentStage !== 'Completed').length} / {totalBags}
          </h3>
          <p className={`text-[11px] mt-2 font-medium ${theme === 'light' ? 'text-stone-600' : 'text-zinc-500'}`}>
            Active bags currently in factory floor
          </p>
        </div>

        {/* KPI 2 */}
        <div className={`p-4.5 rounded-2xl relative overflow-hidden group border transition duration-150 ${
          theme === 'light'
            ? 'bg-white border-stone-200 shadow-sm shadow-stone-100/50'
            : 'bg-[#141416] border-[#262626]'
        }`}>
          <div className="absolute top-0 right-0 p-4 opacity-5 text-rose-500 group-hover:opacity-10 transition-opacity">
            <Clock className="w-16 h-16" />
          </div>
          <p className={`text-[10px] font-mono tracking-wider uppercase font-bold ${theme === 'light' ? 'text-rose-600' : 'text-rose-400'}`}>Critical / Expedited</p>
          <h3 className={`text-2xl font-black mt-1.5 font-mono ${theme === 'light' ? 'text-rose-600' : 'text-rose-400'}`}>
            {urgentCount} <span className="text-xs font-sans">Bags</span>
          </h3>
          <p className={`text-[11px] mt-2 font-medium ${theme === 'light' ? 'text-stone-500' : 'text-zinc-500'}`}>
            Priority marked as Urgent/Express
          </p>
        </div>

        {/* KPI 3 */}
        <div className={`p-4.5 rounded-2xl relative overflow-hidden group border transition duration-150 ${
          theme === 'light'
            ? 'bg-white border-stone-200 shadow-sm shadow-stone-100/50'
            : 'bg-[#141416] border-[#262626]'
        }`}>
          <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${theme === 'light' ? 'text-[#C5A059]' : 'text-[#C5A059]/75'}`}>
            <Scale className="w-16 h-16" />
          </div>
          <p className={`text-[10px] font-mono tracking-wider uppercase font-bold ${theme === 'light' ? 'text-stone-500' : 'text-[#C5A059]/80'}`}>Gold in Production</p>
          <h3 className={`text-2xl font-black mt-1.5 font-mono ${theme === 'light' ? 'text-amber-800' : 'text-[#C5A059]'}`}>
            {totalWeightInProduction.toFixed(2)} <span className="text-xs font-sans">Grams</span>
          </h3>
          <p className={`text-[11px] mt-2 font-medium ${theme === 'light' ? 'text-stone-600' : 'text-zinc-500'}`}>
            Outstanding metal weight in hand
          </p>
        </div>

        {/* KPI 4 */}
        <div className={`p-4.5 rounded-2xl relative overflow-hidden group border transition duration-150 ${
          theme === 'light'
            ? 'bg-white border-stone-200 shadow-sm shadow-stone-100/50'
            : 'bg-[#141416] border-[#262626]'
        }`}>
          <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${theme === 'light' ? 'text-[#C5A059]' : 'text-zinc-500'}`}>
            <AlertTriangle className="w-16 h-16" />
          </div>
          <p className={`text-[10px] font-mono tracking-wider uppercase font-bold ${theme === 'light' ? 'text-stone-500' : 'text-zinc-500'}`}>Avg. Stage Dust Loss</p>
          <h3 className={`text-2xl font-black mt-1.5 font-mono ${theme === 'light' ? 'text-stone-900' : 'text-white'}`}>
            {averageLoss.toFixed(3)} <span className="text-xs font-sans">g</span>
          </h3>
          <p className={`text-[11px] mt-2 font-medium ${theme === 'light' ? 'text-stone-600' : 'text-zinc-500'}`}>
            Filigree filings & casting scrap loss
          </p>
        </div>
      </div>

      {/* Filtering Controls */}
      <div className={`p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border ${
        theme === 'light' ? 'bg-white border-stone-200 shadow-sm' : 'bg-[#141416] border-[#262626]'
      }`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:max-w-xl">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search Job Bag #, Client or Design name..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition border ${
                theme === 'light' 
                  ? 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-500' 
                  : 'bg-[#1C1917]/70 border-[#262626] text-white placeholder-zinc-500 focus:border-[#C5A059]'
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Priority filter */}
          <select
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none border cursor-pointer ${
              theme === 'light' 
                ? 'bg-white border-stone-200 text-stone-900 focus:border-stone-500' 
                : 'bg-[#1C1917]/70 border-[#262626] text-white focus:border-[#C5A059]'
            }`}
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
          >
            <option value="All" className="bg-white dark:bg-[#141416] text-stone-900 dark:text-white">All Priorities</option>
            <option value="Normal" className="bg-white dark:bg-[#141416] text-stone-900 dark:text-white">Normal</option>
            <option value="Urgent" className="bg-white dark:bg-[#141416] text-stone-900 dark:text-white">Urgent</option>
            <option value="Express" className="bg-white dark:bg-[#141416] text-stone-900 dark:text-white">Express</option>
          </select>
        </div>

        <div className={`text-[11px] font-mono font-bold ${theme === 'light' ? 'text-stone-500' : 'text-[#C5A059]'}`}>
          Pipeline Board Filters Active
        </div>
      </div>

      {/* Visual Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stages.map((stage) => {
          const stageBags = filteredBags.filter(b => b.currentStage === stage);
          return (
            <div 
              key={stage}
              className={`rounded-2xl p-4 flex flex-col border transition-all duration-200 ${
                theme === 'light' 
                  ? 'bg-stone-50/40 border-stone-200 h-auto max-h-[650px] min-h-[180px]' 
                  : 'bg-[#141416]/40 border-[#262626] h-[650px]'
              }`}
            >
              {/* Stage Header */}
              <div className={`p-3 rounded-xl border border-transparent font-bold text-center mb-4 flex justify-between items-center ${getStageHeaderColor(stage)}`}>
                <span className="text-[11px] font-mono tracking-wider uppercase">{stage}</span>
                <span className={`border text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-mono font-bold ${
                  theme === 'light'
                    ? 'bg-white border-stone-200 text-stone-800'
                    : 'bg-stone-900 border-[#262626] text-[#C5A059]'
                }`}>
                  {stageBags.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto pb-4 pr-1 scrollbar-thin">
                {stageBags.length === 0 ? (
                  <div className={`h-28 rounded-xl border border-dashed flex items-center justify-center text-center p-3 ${
                    theme === 'light' ? 'border-stone-200 bg-white' : 'border-[#262626] bg-[#141416]/20'
                  }`}>
                    <span className={`text-[10px] font-semibold uppercase font-mono ${
                      theme === 'light' ? 'text-stone-400' : 'text-zinc-600'
                    }`}>No active bags</span>
                  </div>
                ) : (
                  stageBags.map(bag => (
                    <div 
                      key={bag.id}
                      className={`p-3.5 rounded-xl transition duration-200 relative group border ${
                        theme === 'light'
                          ? 'bg-white border-stone-200 shadow-sm hover:shadow-md hover:border-[#C5A059]'
                          : 'bg-[#141416] border-[#262626] hover:border-[#C5A059] shadow-lg'
                      }`}
                    >
                      {/* Priority Tag */}
                      <div className="flex justify-between items-start mb-2.5">
                        <span className={`text-[9px] font-mono font-bold ${
                          theme === 'light' ? 'text-stone-500' : 'text-zinc-400'
                        }`}>{bag.bagNo}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${getPriorityColor(bag.priority)}`}>
                          {bag.priority}
                        </span>
                      </div>

                      {/* Client / Design name */}
                      <div className="space-y-0.5">
                        <h4 className={`text-[11px] font-black line-clamp-1 transition-colors ${
                          theme === 'light' 
                            ? 'text-stone-900 group-hover:text-amber-800' 
                            : 'text-white group-hover:text-[#C5A059]'
                        }`}>
                          {bag.designName}
                        </h4>
                        <p className={`text-[10px] ${
                          theme === 'light' ? 'text-stone-600 font-medium' : 'text-zinc-400'
                        }`}>Client: {bag.clientName}</p>
                      </div>

                      {/* Technical Specs Box */}
                      <div className={`mt-3 py-2 px-2.5 rounded-lg space-y-1.5 text-[10px] border ${
                        theme === 'light'
                          ? 'bg-stone-50 border-stone-150 text-stone-950'
                          : 'bg-[#1C1917]/50 border-[#262626]/80 text-zinc-300'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-mono ${theme === 'light' ? 'text-stone-500' : 'text-zinc-400'}`}>Metal Issued:</span>
                          <span className={`font-mono font-bold ${theme === 'light' ? 'text-stone-900' : 'text-white'}`}>{bag.metalIssuedWeight.toFixed(2)}g</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`font-mono ${theme === 'light' ? 'text-stone-500' : 'text-zinc-400'}`}>Artisan:</span>
                          <span className={`font-bold truncate max-w-[80px] ${theme === 'light' ? 'text-stone-900' : 'text-white'}`} title={bag.assignedKarigarName}>
                            {bag.assignedKarigarName.split(' ')[0]}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`font-mono ${theme === 'light' ? 'text-stone-500' : 'text-zinc-400'}`}>Stones/Lot:</span>
                          <span className={`font-bold truncate max-w-[80px] font-mono ${
                            theme === 'light' ? 'text-amber-800' : 'text-[#C5A059]'
                          }`} title={bag.stonesIssued}>
                            {bag.stonesIssued}
                          </span>
                        </div>
                        {bag.metalLossRecorded > 0 && (
                           <div className={`flex justify-between items-center border-t pt-1 text-[9px] ${
                             theme === 'light' ? 'border-stone-200' : 'border-[#262626]/80'
                           }`}>
                            <span className="text-rose-600 dark:text-rose-400/80 font-mono">Stage Gold Loss:</span>
                            <span className="text-rose-700 dark:text-rose-400 font-mono font-bold">{bag.metalLossRecorded.toFixed(3)}g</span>
                          </div>
                        )}
                      </div>

                      {/* Due date and Action buttons */}
                      <div className={`mt-3.5 pt-2.5 border-t flex items-center justify-between text-[10px] ${
                        theme === 'light' ? 'border-stone-200' : 'border-[#262626]'
                      }`}>
                        <span className={`${theme === 'light' ? 'text-stone-500' : 'text-zinc-400'} font-mono`}>Due: {bag.dueDate}</span>
                        
                        <div className="flex gap-1.5">
                          {/* Print Label tag */}
                          <button
                            title="Print physical Job Bag label"
                            onClick={() => handleOpenTagPreview(bag)}
                            className={`p-1 rounded border transition cursor-pointer ${
                              theme === 'light'
                                ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600 hover:border-stone-500 hover:text-stone-800'
                                : 'bg-[#1C1917]/50 hover:bg-[#262626] border-[#262626] text-zinc-400 hover:border-[#C5A059] hover:text-[#C5A059]'
                            }`}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Advance pipeline */}
                          {stage !== 'Completed' && (
                            <button
                              onClick={() => handleOpenAdvanceModal(bag)}
                              title="Advance production stage"
                              className={`p-1 rounded border transition cursor-pointer ${
                                theme === 'light'
                                  ? 'bg-[#C5A059]/10 border-[#C5A059]/20 hover:border-[#C5A059] text-amber-800 hover:bg-[#C5A059]/20 hover:text-amber-900'
                                  : 'bg-[#C5A059]/10 border-[#C5A059]/20 hover:border-[#C5A059] text-[#C5A059] hover:bg-[#C5A059]/20 hover:text-white'
                              }`}
                            >
                              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: CREATE NEW JOB BAG */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-8 border ${
            theme === 'light'
              ? 'bg-white border-stone-200 text-stone-900'
              : 'bg-[#141416] border-[#262626] text-white'
          }`}>
            <div className={`p-6 flex justify-between items-center border-b ${
              theme === 'light' ? 'border-stone-200 bg-stone-50/50' : 'border-[#262626] bg-[#1C1917]/80'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  theme === 'light' ? 'bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]' : 'bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]'
                }`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${theme === 'light' ? 'text-stone-900' : 'text-white'}`}>Launch Manufacturing Job Bag</h3>
                  <p className={`text-[10px] ${theme === 'light' ? 'text-stone-500' : 'text-[#C5A059]'}`}>Initialize a physical job bag and issue metal to artisan</p>
                </div>
              </div>
              <button 
                onClick={() => setAddModalOpen(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === 'light' ? 'hover:bg-stone-100 text-stone-500' : 'hover:bg-stone-900 text-zinc-400'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLaunchBag} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Client Name */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sharda Sharma"
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition border ${
                      theme === 'light'
                        ? 'bg-white border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:ring-[#C5A059]/25'
                        : 'bg-[#141416] border-[#262626] text-white placeholder-zinc-600 focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                    }`}
                    value={newBag.clientName}
                    onChange={(e) => setNewBag(prev => ({ ...prev, clientName: e.target.value }))}
                  />
                </div>

                {/* Design Name */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Design / Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bridal Kundan Choker"
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition border ${
                      theme === 'light'
                        ? 'bg-white border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:ring-[#C5A059]/25'
                        : 'bg-[#141416] border-[#262626] text-white placeholder-zinc-600 focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                    }`}
                    value={newBag.designName}
                    onChange={(e) => setNewBag(prev => ({ ...prev, designName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Metal Type */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Metal Type</label>
                  <select
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition border cursor-pointer ${
                      theme === 'light'
                        ? 'bg-white border-stone-200 text-stone-900 focus:border-stone-500 focus:ring-[#C5A059]/25'
                        : 'bg-[#141416] border-[#262626] text-white focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                    }`}
                    value={newBag.metalType}
                    onChange={(e) => setNewBag(prev => ({ ...prev, metalType: e.target.value }))}
                  >
                    <option value="Gold (24K)">Gold (24K)</option>
                    <option value="Gold (22K)">Gold (22K)</option>
                    <option value="Gold (18K)">Gold (18K)</option>
                    <option value="Silver (999)">Silver (999)</option>
                    <option value="Platinum (950)">Platinum (950)</option>
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Priority Order</label>
                  <select
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition border cursor-pointer ${
                      theme === 'light'
                        ? 'bg-white border-stone-200 text-stone-900 focus:border-stone-500 focus:ring-[#C5A059]/25'
                        : 'bg-[#141416] border-[#262626] text-white focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                    }`}
                    value={newBag.priority}
                    onChange={(e) => setNewBag(prev => ({ ...prev, priority: e.target.value as any }))}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Express">Express (7 Days)</option>
                    <option value="Urgent">Urgent (48hr Turnaround)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Metal Issued weight */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Metal Issued (Grams) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition border ${
                      theme === 'light'
                        ? 'bg-white border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:ring-[#C5A059]/25'
                        : 'bg-[#141416] border-[#262626] text-white placeholder-zinc-600 focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                    }`}
                    value={newBag.metalIssuedWeight || ''}
                    onChange={(e) => setNewBag(prev => ({ ...prev, metalIssuedWeight: parseFloat(e.target.value) }))}
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Due Date *</label>
                  <input
                    type="date"
                    required
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition border ${
                      theme === 'light'
                        ? 'bg-white border-stone-200 text-stone-900 focus:border-stone-500 focus:ring-[#C5A059]/25'
                        : 'bg-[#141416] border-[#262626] text-white focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                    }`}
                    value={newBag.dueDate}
                    onChange={(e) => setNewBag(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Stones Issued Lot */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Loose Stones Attached</label>
                  <input
                    type="text"
                    placeholder="e.g. 4 Diamond Solitaire (0.80ct)"
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition border ${
                      theme === 'light'
                        ? 'bg-white border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:ring-[#C5A059]/25'
                        : 'bg-[#141416] border-[#262626] text-white placeholder-zinc-600 focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                    }`}
                    value={newBag.stonesIssued}
                    onChange={(e) => setNewBag(prev => ({ ...prev, stonesIssued: e.target.value }))}
                  />
                </div>

                {/* Assigned Artisan */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Select Artisan *</label>
                  <select
                    required
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition border cursor-pointer ${
                      theme === 'light'
                        ? 'bg-white border-stone-200 text-stone-900 focus:border-stone-500 focus:ring-[#C5A059]/25'
                        : 'bg-[#141416] border-[#262626] text-white focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                    }`}
                    value={newBag.assignedKarigarName}
                    onChange={(e) => setNewBag(prev => ({ ...prev, assignedKarigarName: e.target.value }))}
                  >
                    <option value="">-- Choose Karigar --</option>
                    {karigars.map(k => (
                      <option key={k.id} value={k.name} className={theme === 'light' ? 'text-stone-900 bg-white' : 'text-white bg-stone-950'}>{k.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Special instructions */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Special Instructions</label>
                <textarea
                  placeholder="Provide filigree, stone positioning or setting specifications..."
                  className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition h-20 resize-none border ${
                    theme === 'light'
                      ? 'bg-white border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:ring-[#C5A059]/25'
                      : 'bg-[#141416] border-[#262626] text-white placeholder-zinc-600 focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                  }`}
                  value={newBag.notes}
                  onChange={(e) => setNewBag(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              {/* Action Buttons */}
              <div className={`flex gap-3 pt-4 border-t ${theme === 'light' ? 'border-stone-200' : 'border-[#262626]'}`}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className={`flex-1 font-bold text-xs py-3 rounded-xl transition border cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white hover:bg-stone-50 border-stone-300 text-stone-700'
                      : 'bg-transparent hover:bg-stone-900 border-[#262626] text-zinc-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 font-bold text-xs py-3 rounded-xl transition shadow-lg cursor-pointer ${
                    theme === 'light'
                      ? 'bg-stone-900 hover:bg-stone-800 text-[#C5A059] shadow-stone-900/10 border border-[#C5A059]/30'
                      : 'bg-[#C5A059] hover:bg-amber-600 text-[#141416]'
                  }`}
                >
                  Issue Job Bag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADVANCE WORKFLOW STAGE & LOG METAL LOSS */}
      {isAdvanceModalOpen && activeBagForAdvance && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border ${
            theme === 'light'
              ? 'bg-white border-stone-200 text-stone-900'
              : 'bg-[#141416] border-[#262626] text-white'
          }`}>
            <div className={`p-6 flex justify-between items-center border-b ${
              theme === 'light' ? 'border-stone-200 bg-stone-50/50' : 'border-[#262626] bg-[#1C1917]/80'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  theme === 'light' ? 'bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]' : 'bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]'
                }`}>
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${theme === 'light' ? 'text-stone-900' : 'text-white'}`}>Advance Production Stage</h3>
                  <p className={`text-[10px] ${theme === 'light' ? 'text-stone-500' : 'text-[#C5A059]'}`}>Record stage transition and log manufacturing loss</p>
                </div>
              </div>
              <button 
                onClick={() => setAdvanceModalOpen(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === 'light' ? 'hover:bg-stone-100 text-stone-500' : 'hover:bg-stone-900 text-zinc-400'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdvanceStage} className="p-6 space-y-4">
              <div className={`p-4 rounded-xl border space-y-2.5 text-xs ${
                theme === 'light' ? 'bg-stone-50 border-stone-150 text-stone-900' : 'bg-[#1C1917]/50 border-[#262626]/80 text-zinc-300'
              }`}>
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-mono uppercase font-bold ${theme === 'light' ? 'text-stone-500' : 'text-[#C5A059]'}`}>Job Bag No:</span>
                  <span className={`font-mono font-bold ${theme === 'light' ? 'text-stone-900' : 'text-white'}`}>{activeBagForAdvance.bagNo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-mono uppercase font-bold ${theme === 'light' ? 'text-stone-500' : 'text-[#C5A059]'}`}>Current Stage:</span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase font-bold ${
                    theme === 'light' ? 'bg-white border-stone-300 text-stone-800' : 'bg-stone-900 border-[#262626] text-white'
                  }`}>
                    {activeBagForAdvance.currentStage}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-mono uppercase font-bold ${theme === 'light' ? 'text-stone-500' : 'text-[#C5A059]'}`}>Next Stage:</span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase font-bold ${
                    theme === 'light'
                      ? 'bg-[#C5A059]/15 border-[#C5A059]/30 text-amber-900'
                      : 'bg-[#C5A059]/15 border-[#C5A059]/30 text-[#C5A059]'
                  }`}>
                    {stages[stages.indexOf(activeBagForAdvance.currentStage) + 1]}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className={`text-[10px] font-bold font-mono tracking-wider uppercase ${theme === 'light' ? 'text-stone-600' : 'text-[#C5A059]'}`}>Metal Dust / Scrap Loss (Grams)</label>
                  <span className={`text-[10px] font-bold font-mono ${theme === 'light' ? 'text-stone-500' : 'text-[#C5A059]'}`}>Suggested: ~0.050g</span>
                </div>
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="0.000"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 transition border ${
                    theme === 'light'
                      ? 'bg-white border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:ring-[#C5A059]/25'
                      : 'bg-[#141416] border-[#262626] text-white placeholder-zinc-600 focus:border-[#C5A059] focus:ring-[#C5A059]/20'
                  }`}
                  value={stageLoss || ''}
                  onChange={(e) => setStageLoss(parseFloat(e.target.value) || 0)}
                />
                <p className={`text-[10px] leading-normal ${theme === 'light' ? 'text-stone-500' : 'text-zinc-400'}`}>
                  Filing (Chhilai), cutting, and soldering create minor metal filings. Record exact loss for material balance audits.
                </p>
              </div>

              {/* Action Buttons */}
              <div className={`flex gap-3 pt-4 border-t ${theme === 'light' ? 'border-stone-200' : 'border-[#262626]'}`}>
                <button
                  type="button"
                  onClick={() => setAdvanceModalOpen(false)}
                  className={`flex-1 font-bold text-xs py-3 rounded-xl transition border cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white hover:bg-stone-50 border-stone-300 text-stone-700'
                      : 'bg-transparent hover:bg-stone-900 border-[#262626] text-zinc-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 font-bold text-xs py-3 rounded-xl transition shadow-lg cursor-pointer ${
                    theme === 'light'
                      ? 'bg-stone-900 hover:bg-stone-800 text-[#C5A059] shadow-stone-900/10 border border-[#C5A059]/30'
                      : 'bg-[#C5A059] hover:bg-amber-600 text-[#141416]'
                  }`}
                >
                  Advance Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: JOB BAG TAG PRINT PREVIEW */}
      {isTagPreviewOpen && activeBagForTag && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white text-stone-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-stone-200">
            {/* Header with Dark bar */}
            <div className="bg-[#141416] text-white p-5 flex justify-between items-center border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#C5A059]" />
                <span className="font-sans font-bold text-xs tracking-tight uppercase">Job Bag Label Tag</span>
              </div>
              <button 
                onClick={() => setTagPreviewOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-900 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Print Area Layout */}
            <div id="print-area" className="p-6 space-y-6 text-stone-900 font-sans text-xs">
              {/* Badge & Label Header */}
              <div className="flex justify-between items-center border-b border-dashed border-stone-300 pb-3">
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-tight text-[#C5A059]">STITCH ERP</h3>
                  <p className="text-[9px] text-stone-500 font-mono">LOCKED MANUFACTURING JOB</p>
                </div>
                <div className="bg-stone-100 border border-stone-200 px-2.5 py-1 rounded font-mono font-black text-xs text-stone-800">
                  {activeBagForTag.bagNo}
                </div>
              </div>

              {/* Technical Specifications Spec Block */}
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-stone-800">
                <div>
                  <span className="text-[9px] text-stone-400 uppercase font-mono block">Design Specification</span>
                  <span className="font-bold text-xs text-stone-950 block leading-tight">{activeBagForTag.designName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-stone-400 uppercase font-mono block">Client Account</span>
                  <span className="font-bold text-xs text-stone-950 block leading-tight">{activeBagForTag.clientName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-stone-400 uppercase font-mono block">Metal Composition</span>
                  <span className="font-bold text-xs text-stone-950 block leading-tight">{activeBagForTag.metalType}</span>
                </div>
                <div>
                  <span className="text-[9px] text-stone-400 uppercase font-mono block">Issued Weight</span>
                  <span className="font-bold text-xs text-stone-950 block leading-tight font-mono">{activeBagForTag.metalIssuedWeight.toFixed(2)} Grams</span>
                </div>
                <div>
                  <span className="text-[9px] text-stone-400 uppercase font-mono block">Attached Loose Stones</span>
                  <span className="font-bold text-xs text-amber-800 block leading-tight">{activeBagForTag.stonesIssued}</span>
                </div>
                <div>
                  <span className="text-[9px] text-stone-400 uppercase font-mono block">Assigned Artisan</span>
                  <span className="font-bold text-xs text-stone-950 block leading-tight">{activeBagForTag.assignedKarigarName}</span>
                </div>
              </div>

              {/* Real, scannable QR (Milestone 5) & Verification */}
              <div className="border-t border-b border-dashed border-stone-300 py-4 flex flex-col items-center justify-center gap-1.5 bg-stone-50 rounded-xl">
                <TagQRCode value={activeBagForTag.id} size={48} />
                <span className="font-mono text-[9px] text-stone-400 uppercase font-bold">Verification ID: {activeBagForTag.id}</span>
              </div>

              <div className="flex justify-between items-center text-[10px] text-stone-500 font-mono">
                <span>Date Issued: {activeBagForTag.createdAt}</span>
                <span className="text-rose-600 font-extrabold uppercase">Target: {activeBagForTag.dueDate}</span>
              </div>
            </div>

            {/* Print Confirmation Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-3">
              <button
                type="button"
                onClick={() => setTagPreviewOpen(false)}
                className="flex-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-600 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-[#C5A059] hover:bg-amber-600 text-stone-950 hover:text-stone-950 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-[#C5A059]/10 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-stone-950" /> Print Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
