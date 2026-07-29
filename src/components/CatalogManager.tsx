import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Gem,
  Filter,
  QrCode,
  Eye,
  Check,
  X,
  FileSpreadsheet,
  Barcode,
  Scale,
  Award,
  Trash2,
  LayoutTemplate,
  Tags as TagsIcon,
  ScanLine,
  Truck,
  BadgeCheck
} from 'lucide-react';
import { ItemDesign, Tag, ItemCategory, MetalStandard, StoneVariety } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { ALL_TAG_STATUSES, TAG_STATUS_LABEL, canTransition, nextLegalStatuses, type TagStatus } from '../lib/tagStateMachine';
import { TagBarcode, TagQRCode } from './ui/TagCode';
import StockAuditPanel from './StockAuditPanel';
import StockTransferPanel from './StockTransferPanel';
import type { StockTransfer, Branch, MetalRate, HallmarkBatch, HallmarkPolicy } from '../types';
import HallmarkingPanel from './HallmarkingPanel';

interface CatalogManagerProps {
  itemDesigns: ItemDesign[];
  setItemDesigns: React.Dispatch<React.SetStateAction<ItemDesign[]>>;
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  isAddModalOpen: boolean;
  setAddModalOpen: (open: boolean) => void;
  // Inter-branch transfer (Milestone 20) — needs ALL tags, since a transfer spans two branches
  allTags: Tag[];
  transfers: StockTransfer[];
  setTransfers: React.Dispatch<React.SetStateAction<StockTransfer[]>>;
  branches: Branch[];
  activeBranch: Branch | null;
  metalRates: MetalRate[];
  /** AHC dispatch register (Milestone 24). */
  hallmarkBatches: HallmarkBatch[];
  setHallmarkBatches: React.Dispatch<React.SetStateAction<HallmarkBatch[]>>;
  hallmarkPolicy: HallmarkPolicy;
  setHallmarkPolicy: React.Dispatch<React.SetStateAction<HallmarkPolicy>>;
}

const CATEGORIES: ItemCategory[] = ['Rings', 'Necklaces', 'Earrings', 'Bangles', 'Bracelets', 'Chains', 'Coins'];
const OWNERSHIP_TYPES: Tag['stockOwnershipType'][] = ['OWNED', 'GML_FINANCED', 'CONSIGNMENT'];

const OWNERSHIP_LABEL: Record<Tag['stockOwnershipType'], string> = {
  OWNED: 'Owned',
  GML_FINANCED: 'GML Financed',
  CONSIGNMENT: 'Consignment'
};

const OWNERSHIP_BADGE_CLASS: Record<Tag['stockOwnershipType'], string> = {
  OWNED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  GML_FINANCED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  CONSIGNMENT: 'bg-purple-50 text-purple-700 border-purple-200'
};

export default function CatalogManager({
  itemDesigns,
  setItemDesigns,
  tags,
  setTags,
  isAddModalOpen,
  setAddModalOpen,
  allTags,
  transfers,
  setTransfers,
  branches,
  activeBranch,
  metalRates,
  hallmarkBatches,
  setHallmarkBatches,
  hallmarkPolicy,
  setHallmarkPolicy
}: CatalogManagerProps) {
  const { theme } = useTheme();

  // Which tab is active — Item Design Templates, Tag Inventory, or Stock Audit (PRD §5.1, Handbook D-6; Milestone 6)
  const [activeTab, setActiveTab] = useState<'designs' | 'tags' | 'audit' | 'transfers' | 'hallmark'>('tags');

  // Dashboard's "Add Showcase Item" quick action opens the Add Tag modal specifically
  // (adding new physical stock is the more common day-to-day action) and should land on that tab.
  useEffect(() => {
    if (isAddModalOpen) {
      setActiveTab('tags');
    }
  }, [isAddModalOpen]);

  // ---------- Tag Inventory tab state ----------
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedOwnership, setSelectedOwnership] = useState<string>('All');

  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showTagPreview, setShowTagPreview] = useState(false);

  const emptyNewTag: Partial<Tag> = {
    sku: '',
    itemDesignId: '',
    name: '',
    category: 'Rings',
    metalType: 'Gold (22K)',
    grossWeight: 0,
    netWeight: 0,
    wastagePercent: 3,
    makingChargeType: 'per-gram',
    makingChargeValue: 400,
    stoneType: 'None',
    stoneWeight: 0,
    stoneCharge: 0,
    certificateNo: '',
    huid: '',
    stockOwnershipType: 'OWNED',
    status: 'InStock',
    imageUrl: ''
  };
  const [newTag, setNewTag] = useState<Partial<Tag>>(emptyNewTag);
  const [statusChangeError, setStatusChangeError] = useState('');
  const [pendingStatus, setPendingStatus] = useState<TagStatus | ''>('');

  const handleTagStatusChange = (tag: Tag) => {
    if (!pendingStatus) return;
    if (!canTransition(tag.status, pendingStatus)) {
      setStatusChangeError(`Cannot move "${tag.sku}" from ${TAG_STATUS_LABEL[tag.status]} to ${TAG_STATUS_LABEL[pendingStatus]} — that transition is not allowed by the Tag lifecycle.`);
      return;
    }
    setTags(prev => prev.map(t => t.id === tag.id ? { ...t, status: pendingStatus } : t));
    setSelectedTag(prev => prev && prev.id === tag.id ? { ...prev, status: pendingStatus } : prev);
    setStatusChangeError('');
    setPendingStatus('');
  };

  // Selecting a Design pre-fills its defaults onto the new Tag form — still fully editable after.
  const handleDesignSelectForNewTag = (designId: string) => {
    const design = itemDesigns.find(d => d.id === designId);
    if (!design) {
      setNewTag(prev => ({ ...prev, itemDesignId: '' }));
      return;
    }
    setNewTag(prev => ({
      ...prev,
      itemDesignId: design.id,
      name: prev.name || design.name,
      category: design.category,
      metalType: design.metalType,
      wastagePercent: design.defaultWastagePercent,
      makingChargeType: design.defaultMakingChargeType,
      makingChargeValue: design.defaultMakingChargeValue,
      stoneType: prev.stoneType === 'None' ? design.defaultStoneType : prev.stoneType,
      imageUrl: prev.imageUrl || design.imageUrl || ''
    }));
  };

  const totalWeight = tags.reduce((sum, tag) => sum + tag.netWeight, 0);

  const filteredTags = tags.filter(tag => {
    const matchesSearch =
      tag.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tag.certificateNo && tag.certificateNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tag.huid && tag.huid.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'All' || tag.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || tag.status === selectedStatus;
    const matchesOwnership = selectedOwnership === 'All' || tag.stockOwnershipType === selectedOwnership;

    return matchesSearch && matchesCategory && matchesStatus && matchesOwnership;
  });

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.sku || !newTag.itemDesignId || !newTag.name || !newTag.grossWeight || !newTag.netWeight) {
      alert("Please fill all required fields, including the Item Design this piece belongs to!");
      return;
    }

    const tagToAdd: Tag = {
      id: `tag-${Date.now()}`,
      sku: newTag.sku,
      itemDesignId: newTag.itemDesignId,
      name: newTag.name,
      category: newTag.category as ItemCategory,
      metalType: newTag.metalType as MetalStandard,
      grossWeight: Number(newTag.grossWeight),
      netWeight: Number(newTag.netWeight),
      wastagePercent: Number(newTag.wastagePercent || 0),
      makingChargeType: newTag.makingChargeType as 'per-gram' | 'flat',
      makingChargeValue: Number(newTag.makingChargeValue || 0),
      stoneType: newTag.stoneType as StoneVariety,
      stoneWeight: Number(newTag.stoneWeight || 0),
      stoneCharge: Number(newTag.stoneCharge || 0),
      certificateNo: newTag.certificateNo || undefined,
      huid: newTag.huid || undefined,
      stockOwnershipType: newTag.stockOwnershipType as Tag['stockOwnershipType'],
      status: newTag.status as Tag['status'],
      imageUrl: newTag.imageUrl || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&auto=format&fit=crop&q=60'
    };

    setTags(prev => [tagToAdd, ...prev]);
    setAddModalOpen(false);
    setNewTag(emptyNewTag);
  };

  const handleDeleteTag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this tag from inventory?")) {
      setTags(prev => prev.filter(t => t.id !== id));
      if (selectedTag?.id === id) {
        setSelectedTag(null);
      }
    }
  };

  const getStatusColor = (status: TagStatus) => {
    switch (status) {
      case 'InStock': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'InShowcase': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'OutForJobwork': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Sold': return 'bg-yellow-400 text-black border-yellow-500';
      case 'DamagedOrMelted': return 'bg-red-50 text-red-700 border-red-200';
      case 'PendingHallmark': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Hallmarked': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'RawMetal': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'IssuedToKarigar': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ReceivedFromKarigar': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'MemoOut': return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
      case 'TransferInTransit': return 'bg-sky-50 text-sky-700 border-sky-200';
      default: return 'bg-white text-slate-800 border-slate-200';
    }
  };

  const statuses: ('All' | TagStatus)[] = ['All', ...ALL_TAG_STATUSES];

  // ---------- Item Design Templates tab state ----------
  const [designSearchTerm, setDesignSearchTerm] = useState('');
  const [selectedDesignCategory, setSelectedDesignCategory] = useState<string>('All');
  const [isAddDesignModalOpen, setAddDesignModalOpen] = useState(false);

  const emptyNewDesign: Partial<ItemDesign> = {
    designCode: '',
    name: '',
    category: 'Rings',
    metalType: 'Gold (22K)',
    defaultWastagePercent: 3,
    defaultMakingChargeType: 'per-gram',
    defaultMakingChargeValue: 400,
    defaultStoneType: 'None',
    hsnCode: '7113',
    imageUrl: '',
    isActive: true
  };
  const [newDesign, setNewDesign] = useState<Partial<ItemDesign>>(emptyNewDesign);

  const filteredDesigns = itemDesigns.filter(design => {
    const matchesSearch =
      design.designCode.toLowerCase().includes(designSearchTerm.toLowerCase()) ||
      design.name.toLowerCase().includes(designSearchTerm.toLowerCase());
    const matchesCategory = selectedDesignCategory === 'All' || design.category === selectedDesignCategory;
    return matchesSearch && matchesCategory;
  });

  const tagCountByDesign = (designId: string) => tags.filter(t => t.itemDesignId === designId).length;

  const handleAddDesign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesign.designCode || !newDesign.name) {
      alert("Please fill in Design Code and Name!");
      return;
    }

    const designToAdd: ItemDesign = {
      id: `design-${Date.now()}`,
      designCode: newDesign.designCode,
      name: newDesign.name,
      category: newDesign.category as ItemCategory,
      metalType: newDesign.metalType as MetalStandard,
      defaultWastagePercent: Number(newDesign.defaultWastagePercent || 0),
      defaultMakingChargeType: newDesign.defaultMakingChargeType as 'per-gram' | 'flat',
      defaultMakingChargeValue: Number(newDesign.defaultMakingChargeValue || 0),
      defaultStoneType: newDesign.defaultStoneType as StoneVariety,
      hsnCode: newDesign.hsnCode || undefined,
      imageUrl: newDesign.imageUrl || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&auto=format&fit=crop&q=60',
      isActive: newDesign.isActive !== false
    };

    setItemDesigns(prev => [designToAdd, ...prev]);
    setAddDesignModalOpen(false);
    setNewDesign(emptyNewDesign);
  };

  const handleDeleteDesign = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tagCountByDesign(id) > 0) {
      alert("Cannot delete a design that still has tagged physical stock. Deactivate it instead, or reassign/remove its tags first.");
      return;
    }
    if (confirm("Are you sure you want to delete this design template?")) {
      setItemDesigns(prev => prev.filter(d => d.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Design Templates vs. Tag Inventory tabs */}
      <div className="flex border-b border-slate-150 gap-4">
        <button
          onClick={() => setActiveTab('tags')}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'tags'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <TagsIcon className="w-4 h-4" /> Tag Inventory
        </button>
        <button
          onClick={() => setActiveTab('designs')}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'designs'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <LayoutTemplate className="w-4 h-4" /> Item Design Templates
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ScanLine className="w-4 h-4" /> Stock Audit
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'transfers'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Truck className="w-4 h-4" /> Stock Transfers
        </button>
        <button
          onClick={() => setActiveTab('hallmark')}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'hallmark'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <BadgeCheck className="w-4 h-4" /> Hallmarking
        </button>
      </div>

      {activeTab === 'hallmark' ? (
        <HallmarkingPanel
          tags={tags}
          setTags={setTags}
          batches={hallmarkBatches}
          setBatches={setHallmarkBatches}
          activeBranch={activeBranch}
          policy={hallmarkPolicy}
          setPolicy={setHallmarkPolicy}
        />
      ) : activeTab === 'transfers' ? (
        <StockTransferPanel
          allTags={allTags}
          setTags={setTags}
          transfers={transfers}
          setTransfers={setTransfers}
          branches={branches}
          activeBranch={activeBranch}
          metalRates={metalRates}
        />
      ) : activeTab === 'audit' ? (
        <StockAuditPanel tags={tags} />
      ) : activeTab === 'tags' ? (
        <div className="space-y-6">
          {/* Search and Filters panel */}
          <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by SKU, Design Name, Certificate, or HUID..."
                  className="w-full text-sm pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Quick Add Button */}
              <button
                onClick={() => setAddModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-5 py-2.5 rounded-xl transition duration-150"
              >
                <Plus className="w-4.5 h-4.5" /> Tag New Physical Piece
              </button>
            </div>

            {/* Filters and Tags */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-y-3 justify-between">
              {/* Category tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400 mr-2 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Category:
                </span>
                {['All', ...CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-black font-semibold border border-amber-500'
                        : 'bg-white text-slate-700 hover:bg-amber-50/50 border border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Status tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400 mr-2">Status:</span>
                {statuses.map((stat) => (
                  <button
                    key={stat}
                    onClick={() => setSelectedStatus(stat)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                      selectedStatus === stat
                        ? 'bg-amber-500 text-black font-semibold border border-amber-500'
                        : 'bg-white text-slate-700 hover:bg-amber-50/50 border border-slate-200'
                    }`}
                  >
                    {stat === 'All' ? 'All' : TAG_STATUS_LABEL[stat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock Ownership filter row (Handbook §1.6/D-3) */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400 mr-2">Stock Ownership:</span>
              {['All', ...OWNERSHIP_TYPES].map((own) => (
                <button
                  key={own}
                  onClick={() => setSelectedOwnership(own)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                    selectedOwnership === own
                      ? 'bg-amber-500 text-black font-semibold border border-amber-500'
                      : 'bg-white text-slate-700 hover:bg-amber-50/50 border border-slate-200'
                  }`}
                >
                  {own === 'All' ? 'All' : OWNERSHIP_LABEL[own as Tag['stockOwnershipType']]}
                </button>
              ))}
            </div>
          </div>

          {/* Grid listing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredTags.map((tag) => {
              const design = itemDesigns.find(d => d.id === tag.itemDesignId);
              return (
                <div
                  key={tag.id}
                  onClick={() => {
                    setSelectedTag(tag);
                    setShowTagPreview(false);
                    setPendingStatus('');
                    setStatusChangeError('');
                  }}
                  className="bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-amber-400/50 transition duration-250 flex flex-col group cursor-pointer"
                >
                  {/* Image section with relative overlays */}
                  <div className="h-44 bg-white relative overflow-hidden shrink-0">
                    <img
                      src={tag.imageUrl}
                      alt={tag.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(tag.status)}`}>
                        {TAG_STATUS_LABEL[tag.status]}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${OWNERSHIP_BADGE_CLASS[tag.stockOwnershipType]}`}>
                        {OWNERSHIP_LABEL[tag.stockOwnershipType]}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-yellow-400 text-black font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                      {tag.metalType.replace('Gold ', '')}
                    </div>
                  </div>

                  {/* Core Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="font-mono text-[10px] font-bold text-slate-400 uppercase leading-none mb-1.5">{tag.sku}</p>
                      <h4 className="font-sans font-bold text-slate-800 text-sm leading-snug truncate group-hover:text-amber-700 transition">
                        {tag.name}
                      </h4>
                      {design && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">Design: {design.designCode}</p>
                      )}
                    </div>

                    {/* Weights & Stone Info */}
                    <div className="mt-3.5 grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block">Weights</span>
                        <span className="font-mono text-xs font-bold text-slate-800">
                          N: {tag.netWeight.toFixed(2)}g / G: {tag.grossWeight.toFixed(2)}g
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block">Stones</span>
                        <span className="font-sans text-xs font-bold text-slate-800 truncate block">
                          {tag.stoneType === 'None' ? 'None' : `${tag.stoneType} (${tag.stoneWeight}ct)`}
                        </span>
                      </div>
                    </div>

                    {/* Valuation estimation & Action buttons */}
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Estimated Value</span>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          ₹{((tag.netWeight * 6650) + tag.stoneCharge).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          title="View Tag Details"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTag(tag.id, e)}
                          title="Delete tag"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTags.length === 0 && (
            <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center shadow-sm">
              <Gem className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-800">No tagged stock found matching query.</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting your filters, searching another SKU/HUID, or tag a new physical piece.</p>
            </div>
          )}

          {/* DETAIL VIEW & BARCODE TAG GENERATOR MODAL */}
          {selectedTag && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={`rounded-3xl overflow-hidden border shadow-2xl w-full max-w-3xl flex flex-col md:flex-row relative transition-all duration-200 ${
                theme === 'light' ? 'bg-white border-zinc-200 text-slate-800' : 'bg-[#141416] border-zinc-800 text-zinc-100'
              }`}>
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`absolute top-4 right-4 z-10 p-2 rounded-full transition shadow ${
                    theme === 'light'
                      ? 'bg-zinc-100 hover:bg-zinc-200 text-slate-700'
                      : 'bg-slate-950/80 hover:bg-slate-900 text-white'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Left Col: Photo or Tag representation */}
                <div className={`w-full md:w-1/2 flex flex-col justify-between border-r transition-colors duration-200 ${
                  theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-800/50'
                }`}>
                  {showTagPreview ? (
                    /* Print Barcode Jewelry Tag Layout */
                    <div className={`p-8 h-full flex items-center justify-center transition-colors duration-200 ${
                      theme === 'light' ? 'bg-amber-50/25' : 'bg-amber-950/5'
                    }`}>
                      <div id="print-area" className={`w-64 border border-dashed p-4.5 rounded-lg shadow-sm font-mono text-[10px] select-none flex flex-col justify-between h-96 transition-colors duration-200 ${
                        theme === 'light'
                          ? 'bg-white border-amber-600/60 text-slate-800'
                          : 'bg-[#1a1a1c] border-amber-600/30 text-zinc-200'
                      }`}>
                        {/* Tag Header */}
                        <div className={`border-b border-dashed pb-2 text-center ${theme === 'light' ? 'border-slate-200' : 'border-zinc-800'}`}>
                          <p className={`font-sans font-bold text-xs uppercase tracking-tight ${theme === 'light' ? 'text-amber-800' : 'text-amber-500'}`}>STITCH SHOWROOM</p>
                          <p className={`text-[9px] ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>MUM-01-TERMINAL</p>
                        </div>

                        {/* Weight Breakdown */}
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>SKU:</span>
                            <span className="font-bold">{selectedTag.sku}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Karat:</span>
                            <span className="font-bold">{selectedTag.metalType}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Gross Wt:</span>
                            <span className="font-bold">{selectedTag.grossWeight.toFixed(2)}g</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Net Wt:</span>
                            <span className="font-bold">{selectedTag.netWeight.toFixed(2)}g</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Wastage:</span>
                            <span className="font-bold">{selectedTag.wastagePercent}%</span>
                          </div>
                          {selectedTag.stoneType !== 'None' && (
                            <div className="flex justify-between">
                              <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Stones:</span>
                              <span className="font-bold">{selectedTag.stoneType} ({selectedTag.stoneWeight}ct)</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Ownership:</span>
                            <span className="font-bold">{OWNERSHIP_LABEL[selectedTag.stockOwnershipType]}</span>
                          </div>
                        </div>

                        {/* Hallmark badge — real HUID field (Milestone 3); assignment itself is Milestone 24 */}
                        <div
                          className="flex items-center justify-center gap-3 py-1 rounded border transition-colors duration-200"
                          style={{
                            backgroundColor: theme === 'light' ? '#FFFDF4' : 'rgba(197, 160, 89, 0.1)',
                            borderColor: theme === 'light' ? '#C5A059' : 'rgba(197, 160, 89, 0.3)',
                          }}
                        >
                          <Award className="w-5 h-5 shrink-0" style={{ color: theme === 'light' ? '#8C6D34' : '#C5A059' }} />
                          <div>
                            <p className="font-sans font-black text-[8px] leading-none" style={{ color: theme === 'light' ? '#4A3718' : '#F3E5AB' }}>
                              {selectedTag.huid ? 'BIS HALLMARKED' : 'NOT YET HALLMARKED'}
                            </p>
                            <p className="text-[7px] font-mono leading-none mt-0.5" style={{ color: theme === 'light' ? '#705325' : '#D9B875' }}>
                              {selectedTag.huid ? `HUID: ${selectedTag.huid}` : 'Pending AHC dispatch'}
                            </p>
                          </div>
                        </div>

                        {/* Real, scannable QR + barcode (Milestone 5) — QR encodes the full Tag ID for lookup, barcode encodes the SKU for POS scan-to-bill */}
                        <div className={`flex items-center justify-center gap-3 pt-2 border-t border-dashed ${theme === 'light' ? 'border-slate-200' : 'border-zinc-800'}`}>
                          <div className="p-1 rounded bg-white">
                            <TagQRCode value={selectedTag.id} size={44} />
                          </div>
                          <div className="text-center p-1 rounded bg-white">
                            <TagBarcode value={selectedTag.sku} height={32} />
                            <p className="text-[8px] mt-0.5 text-slate-500">{selectedTag.sku}</p>
                          </div>
                        </div>

                        <p className={`text-[7px] text-center leading-none ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>DO NOT REMOVE FROM ORNAMENT</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full relative min-h-[300px]">
                      <img
                        src={selectedTag.imageUrl}
                        alt={selectedTag.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent p-6 flex flex-col justify-end">
                        <p className="font-mono text-xs font-bold text-amber-400 uppercase tracking-widest">{selectedTag.sku}</p>
                        <h3 className="font-sans font-black text-xl text-white tracking-tight leading-tight">{selectedTag.name}</h3>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Col: Operations */}
                <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-between">
                  <div>
                    <h4 className={`text-xs uppercase font-bold tracking-wider font-mono mb-2 ${
                      theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                    }`}>Ornament Operational Details</h4>

                    <div className="grid grid-cols-2 gap-4 mt-4 text-xs font-medium">
                      <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                      }`}>
                        <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                          theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                        }`}>Category</span>
                        <span className="font-bold">{selectedTag.category}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                      }`}>
                        <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                          theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                        }`}>Metal Purity</span>
                        <span className="font-bold">{selectedTag.metalType}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                      }`}>
                        <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                          theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                        }`}>Net Weight</span>
                        <span className="font-bold font-mono">{selectedTag.netWeight.toFixed(3)} grams</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                      }`}>
                        <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                          theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                        }`}>Allowed Wastage</span>
                        <span className="font-bold font-mono">{selectedTag.wastagePercent}%</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                      }`}>
                        <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                          theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                        }`}>Making Charges</span>
                        <span className="font-bold font-mono">
                          {selectedTag.makingChargeType === 'per-gram' ? `₹${selectedTag.makingChargeValue}/g` : `₹${selectedTag.makingChargeValue} Flat`}
                        </span>
                      </div>
                      <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                      }`}>
                        <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                          theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                        }`}>Certification No</span>
                        <span className="font-bold font-mono">{selectedTag.certificateNo || 'Uncertified'}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                      }`}>
                        <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                          theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                        }`}>HUID</span>
                        <span className="font-bold font-mono">{selectedTag.huid || 'Not Yet Hallmarked'}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                      }`}>
                        <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                          theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                        }`}>Stock Ownership</span>
                        <span className="font-bold">{OWNERSHIP_LABEL[selectedTag.stockOwnershipType]}</span>
                      </div>
                    </div>

                    {/* Tag lifecycle status transition — every status change is validated through canTransition() (Milestone 4) */}
                    <div className={`mt-4 p-3 rounded-xl border transition-colors duration-200 ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-zinc-900/50 border-zinc-800/80'
                    }`}>
                      <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-2 ${
                        theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                      }`}>Lifecycle Status</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(selectedTag.status)}`}>
                          {TAG_STATUS_LABEL[selectedTag.status]}
                        </span>
                        {nextLegalStatuses(selectedTag.status).length > 0 && (
                          <>
                            <span className={theme === 'light' ? 'text-slate-300' : 'text-zinc-700'}>→</span>
                            <select
                              value={pendingStatus}
                              onChange={(e) => setPendingStatus(e.target.value as TagStatus)}
                              className={`flex-1 text-xs rounded-lg px-2 py-1.5 border ${
                                theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                              }`}
                            >
                              <option value="">Move to...</option>
                              {nextLegalStatuses(selectedTag.status).map(s => (
                                <option key={s} value={s}>{TAG_STATUS_LABEL[s]}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleTagStatusChange(selectedTag)}
                              disabled={!pendingStatus}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 transition"
                            >
                              Move
                            </button>
                          </>
                        )}
                      </div>
                      {statusChangeError && (
                        <p className="text-[11px] text-red-500 font-semibold mt-2">{statusChangeError}</p>
                      )}
                    </div>

                    {selectedTag.stoneType !== 'None' && (
                      <div className={`mt-4 p-3 rounded-xl border flex justify-between items-center text-xs transition-colors duration-200 ${
                        theme === 'light'
                          ? 'bg-amber-50/40 border-amber-100 text-amber-800'
                          : 'bg-amber-950/10 border-amber-900/30 text-amber-300'
                      }`}>
                        <div>
                          <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                            theme === 'light' ? 'text-slate-400 font-medium' : 'text-zinc-500'
                          }`}>Stone Setting</span>
                          <span className={`font-bold ${theme === 'light' ? 'text-amber-800' : 'text-amber-200'}`}>
                            {selectedTag.stoneType} ({selectedTag.stoneWeight} carat)
                          </span>
                        </div>
                        <div>
                          <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono text-right mb-0.5 ${
                            theme === 'light' ? 'text-slate-400 font-medium' : 'text-zinc-500'
                          }`}>Stone Cost</span>
                          <span className={`font-bold font-mono block text-right ${theme === 'light' ? 'text-amber-800' : 'text-amber-200'}`}>
                            ₹{selectedTag.stoneCharge.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tag Controls / Actions */}
                  <div className={`pt-6 border-t mt-6 flex gap-3 ${theme === 'light' ? 'border-slate-100' : 'border-zinc-800'}`}>
                    <button
                      onClick={() => setShowTagPreview(!showTagPreview)}
                      className={`flex-1 flex items-center justify-center gap-2 border text-xs font-bold px-4 py-2.5 rounded-xl transition duration-150 ${
                        theme === 'light'
                          ? 'border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-slate-700 hover:text-amber-800'
                          : 'border-zinc-800 hover:border-amber-500/50 hover:bg-amber-950/20 text-zinc-300 hover:text-amber-400'
                      }`}
                    >
                      <Barcode className="w-4 h-4" />
                      {showTagPreview ? "View Photo" : "Generate Barcode Tag"}
                    </button>
                    {showTagPreview && (
                      <button
                        onClick={() => {
                          window.print();
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                      >
                        Print Tag
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ADD NEW TAG (PHYSICAL PIECE) DIALOG MODAL */}
          {isAddModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <Gem className="w-5 h-5 text-amber-500" />
                    <h3 className="font-sans font-bold text-slate-900 text-lg">Tag New Physical Ornament</h3>
                  </div>
                  <button
                    onClick={() => setAddModalOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddTag} className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Item Design Template *</label>
                    <select
                      required
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                      value={newTag.itemDesignId}
                      onChange={(e) => handleDesignSelectForNewTag(e.target.value)}
                    >
                      <option value="">-- Choose Design Template --</option>
                      {itemDesigns.filter(d => d.isActive).map(d => (
                        <option key={d.id} value={d.id}>[{d.designCode}] {d.name}</option>
                      ))}
                    </select>
                    {itemDesigns.length === 0 && (
                      <p className="text-[10px] text-rose-500 mt-1">No design templates exist yet — add one from the Item Design Templates tab first.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tag SKU *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. RNG-22K-084"
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newTag.sku}
                        onChange={(e) => setNewTag({ ...newTag, sku: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Category *</label>
                      <select
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                        value={newTag.category}
                        onChange={(e) => setNewTag({ ...newTag, category: e.target.value as ItemCategory })}
                      >
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Piece Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Antique Emerald Ring"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                      value={newTag.name}
                      onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Metal Standard *</label>
                      <select
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                        value={newTag.metalType}
                        onChange={(e) => setNewTag({ ...newTag, metalType: e.target.value as MetalStandard })}
                      >
                        <option value="Gold (24K)">Gold (24K) - 99.9%</option>
                        <option value="Gold (22K)">Gold (22K) - 91.6%</option>
                        <option value="Gold (18K)">Gold (18K) - 75.0%</option>
                        <option value="Silver (999)">Silver (999) - 99.9%</option>
                        <option value="Platinum (950)">Platinum (950) - 95.0%</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Certificate Number</label>
                      <input
                        type="text"
                        placeholder="e.g. GIA-748391 or BIS-982"
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newTag.certificateNo}
                        onChange={(e) => setNewTag({ ...newTag, certificateNo: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Gross Weight (g) *</label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        placeholder="0.000"
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newTag.grossWeight || ''}
                        onChange={(e) => setNewTag({ ...newTag, grossWeight: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Net Weight (g) *</label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        placeholder="0.000"
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newTag.netWeight || ''}
                        onChange={(e) => setNewTag({ ...newTag, netWeight: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Wastage (%) *</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        placeholder="e.g. 3.5"
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newTag.wastagePercent ?? 3}
                        onChange={(e) => setNewTag({ ...newTag, wastagePercent: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Making Type *</label>
                      <select
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                        value={newTag.makingChargeType}
                        onChange={(e) => setNewTag({ ...newTag, makingChargeType: e.target.value as 'per-gram' | 'flat' })}
                      >
                        <option value="per-gram">Per Gram Net Weight</option>
                        <option value="flat">Flat Labor Fee</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Making Value (₹) *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 450"
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newTag.makingChargeValue || ''}
                        onChange={(e) => setNewTag({ ...newTag, makingChargeValue: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-150">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Stone Detail</label>
                      <select
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-250 bg-white rounded-md focus:outline-none"
                        value={newTag.stoneType}
                        onChange={(e) => setNewTag({ ...newTag, stoneType: e.target.value as StoneVariety })}
                      >
                        <option value="None">None</option>
                        <option value="Diamond">Diamond</option>
                        <option value="Ruby">Ruby</option>
                        <option value="Emerald">Emerald</option>
                        <option value="Sapphire">Sapphire</option>
                        <option value="Cubic Zirconia">Cubic Zirconia</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Weight (ct)</label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={newTag.stoneType === 'None'}
                        placeholder="0.00"
                        className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-250 rounded-md focus:outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                        value={newTag.stoneWeight || ''}
                        onChange={(e) => setNewTag({ ...newTag, stoneWeight: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Charges (₹)</label>
                      <input
                        type="number"
                        disabled={newTag.stoneType === 'None'}
                        placeholder="0"
                        className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-250 rounded-md focus:outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                        value={newTag.stoneCharge || ''}
                        onChange={(e) => setNewTag({ ...newTag, stoneCharge: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">HUID (if hallmarked)</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. A1B2C3"
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 uppercase"
                        value={newTag.huid}
                        onChange={(e) => setNewTag({ ...newTag, huid: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Stock Ownership *</label>
                      <select
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                        value={newTag.stockOwnershipType}
                        onChange={(e) => setNewTag({ ...newTag, stockOwnershipType: e.target.value as Tag['stockOwnershipType'] })}
                      >
                        {OWNERSHIP_TYPES.map(own => (
                          <option key={own} value={own}>{OWNERSHIP_LABEL[own]}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Photo URL (Stock Illustration)</label>
                    <input
                      type="text"
                      placeholder="Paste direct URL or leave empty for dynamic stock image"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                      value={newTag.imageUrl}
                      onChange={(e) => setNewTag({ ...newTag, imageUrl: e.target.value })}
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
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
                      Record & Tag Ornament
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Design Templates search/filter panel */}
          <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Design Code or Name..."
                  className="w-full text-sm pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-white"
                  value={designSearchTerm}
                  onChange={(e) => setDesignSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => setAddDesignModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition duration-150"
              >
                <Plus className="w-4.5 h-4.5" /> Add Design Template
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400 mr-2 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Category:
              </span>
              {['All', ...CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedDesignCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    selectedDesignCategory === cat
                      ? 'bg-amber-500 text-black font-semibold border border-amber-500'
                      : 'bg-white text-slate-700 hover:bg-amber-50/50 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Design Templates grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredDesigns.map((design) => (
              <div
                key={design.id}
                onClick={() => {
                  setActiveTab('tags');
                  setSearchTerm(design.designCode);
                  setSelectedCategory('All');
                  setSelectedStatus('All');
                  setSelectedOwnership('All');
                }}
                title="View tagged stock for this design"
                className="bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-amber-400/50 transition duration-250 flex flex-col group cursor-pointer"
              >
                <div className="h-36 bg-white relative overflow-hidden shrink-0">
                  <img
                    src={design.imageUrl}
                    alt={design.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      design.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {design.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-yellow-400 text-black font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                    {design.metalType.replace('Gold ', '')}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-mono text-[10px] font-bold text-slate-400 uppercase leading-none mb-1.5">{design.designCode}</p>
                    <h4 className="font-sans font-bold text-slate-800 text-sm leading-snug truncate group-hover:text-amber-700 transition">
                      {design.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{design.category} • HSN {design.hsnCode || '—'}</p>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block">Default Wastage</span>
                      <span className="font-mono text-xs font-bold text-slate-800">{design.defaultWastagePercent}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block">Default MC</span>
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {design.defaultMakingChargeType === 'per-gram' ? `₹${design.defaultMakingChargeValue}/g` : `₹${design.defaultMakingChargeValue} Flat`}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Tagged Stock</span>
                      <span className="font-mono font-black text-slate-900 text-sm">{tagCountByDesign(design.id)} pieces</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteDesign(design.id, e)}
                      title="Delete design template"
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredDesigns.length === 0 && (
            <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center shadow-sm">
              <LayoutTemplate className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-800">No design templates found matching query.</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting your filters, or add a new design template.</p>
            </div>
          )}

          {/* ADD DESIGN TEMPLATE MODAL */}
          {isAddDesignModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="w-5 h-5 text-amber-500" />
                    <h3 className="font-sans font-bold text-slate-900 text-lg">New Item Design Template</h3>
                  </div>
                  <button
                    onClick={() => setAddDesignModalOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddDesign} className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Design Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. RNG-22K-090"
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newDesign.designCode}
                        onChange={(e) => setNewDesign({ ...newDesign, designCode: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Category *</label>
                      <select
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                        value={newDesign.category}
                        onChange={(e) => setNewDesign({ ...newDesign, category: e.target.value as ItemCategory })}
                      >
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Design Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Antique Emerald Ring"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                      value={newDesign.name}
                      onChange={(e) => setNewDesign({ ...newDesign, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Metal Standard *</label>
                      <select
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                        value={newDesign.metalType}
                        onChange={(e) => setNewDesign({ ...newDesign, metalType: e.target.value as MetalStandard })}
                      >
                        <option value="Gold (24K)">Gold (24K) - 99.9%</option>
                        <option value="Gold (22K)">Gold (22K) - 91.6%</option>
                        <option value="Gold (18K)">Gold (18K) - 75.0%</option>
                        <option value="Silver (999)">Silver (999) - 99.9%</option>
                        <option value="Platinum (950)">Platinum (950) - 95.0%</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">HSN Code</label>
                      <input
                        type="text"
                        placeholder="7113"
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newDesign.hsnCode}
                        onChange={(e) => setNewDesign({ ...newDesign, hsnCode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Default Wastage (%) *</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newDesign.defaultWastagePercent ?? 3}
                        onChange={(e) => setNewDesign({ ...newDesign, defaultWastagePercent: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Default MC Type *</label>
                      <select
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                        value={newDesign.defaultMakingChargeType}
                        onChange={(e) => setNewDesign({ ...newDesign, defaultMakingChargeType: e.target.value as 'per-gram' | 'flat' })}
                      >
                        <option value="per-gram">Per Gram</option>
                        <option value="flat">Flat</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Default MC Value (₹) *</label>
                      <input
                        type="number"
                        required
                        className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                        value={newDesign.defaultMakingChargeValue || ''}
                        onChange={(e) => setNewDesign({ ...newDesign, defaultMakingChargeValue: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Default Stone Type</label>
                      <select
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                        value={newDesign.defaultStoneType}
                        onChange={(e) => setNewDesign({ ...newDesign, defaultStoneType: e.target.value as StoneVariety })}
                      >
                        <option value="None">None</option>
                        <option value="Diamond">Diamond</option>
                        <option value="Ruby">Ruby</option>
                        <option value="Emerald">Emerald</option>
                        <option value="Sapphire">Sapphire</option>
                        <option value="Cubic Zirconia">Cubic Zirconia</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={newDesign.isActive !== false}
                          onChange={(e) => setNewDesign({ ...newDesign, isActive: e.target.checked })}
                          className="w-4 h-4 accent-amber-500"
                        />
                        Active (offered for new tagging)
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Photo URL</label>
                    <input
                      type="text"
                      placeholder="Paste direct URL or leave empty for dynamic stock image"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                      value={newDesign.imageUrl}
                      onChange={(e) => setNewDesign({ ...newDesign, imageUrl: e.target.value })}
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setAddDesignModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition"
                    >
                      Save Design Template
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
