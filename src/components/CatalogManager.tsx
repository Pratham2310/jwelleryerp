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
  Trash2
} from 'lucide-react';
import { JewelleryItem } from '../types';

interface CatalogManagerProps {
  items: JewelleryItem[];
  setItems: React.Dispatch<React.SetStateAction<JewelleryItem[]>>;
  isAddModalOpen: boolean;
  setAddModalOpen: (open: boolean) => void;
}

export default function CatalogManager({ 
  items, 
  setItems, 
  isAddModalOpen, 
  setAddModalOpen 
}: CatalogManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('stitch_theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    const checkTheme = () => {
      const isLight = document.documentElement.classList.contains('light');
      setTheme(isLight ? 'light' : 'dark');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  // Detail Modal state
  const [selectedItem, setSelectedItem] = useState<JewelleryItem | null>(null);
  const [showTagPreview, setShowTagPreview] = useState(false);

  // Form state for adding new item
  const [newItem, setNewItem] = useState<Partial<JewelleryItem>>({
    sku: '',
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
    status: 'In Stock',
    imageUrl: ''
  });

  // Calculate stats
  const totalWeight = items.reduce((sum, item) => sum + item.netWeight, 0);
  const totalValueMock = items.reduce((sum, item) => {
    const rawMetalValue = item.netWeight * 6650; // estimate based on gold
    return sum + rawMetalValue + item.stoneCharge;
  }, 0);

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.certificateNo && item.certificateNo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.sku || !newItem.name || !newItem.grossWeight || !newItem.netWeight) {
      alert("Please fill all required fields!");
      return;
    }

    const itemToAdd: JewelleryItem = {
      id: `item-${Date.now()}`,
      sku: newItem.sku,
      name: newItem.name,
      category: newItem.category as any,
      metalType: newItem.metalType as any,
      grossWeight: Number(newItem.grossWeight),
      netWeight: Number(newItem.netWeight),
      wastagePercent: Number(newItem.wastagePercent || 0),
      makingChargeType: newItem.makingChargeType as any,
      makingChargeValue: Number(newItem.makingChargeValue || 0),
      stoneType: newItem.stoneType as any,
      stoneWeight: Number(newItem.stoneWeight || 0),
      stoneCharge: Number(newItem.stoneCharge || 0),
      certificateNo: newItem.certificateNo || undefined,
      status: newItem.status as any,
      imageUrl: newItem.imageUrl || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&auto=format&fit=crop&q=60'
    };

    setItems(prev => [itemToAdd, ...prev]);
    setAddModalOpen(false);
    
    // Reset Form
    setNewItem({
      sku: '',
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
      status: 'In Stock',
      imageUrl: ''
    });
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this catalogue item?")) {
      setItems(prev => prev.filter(i => i.id !== id));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'In Showcase': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Out for Jobwork': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Sold': return 'bg-yellow-400 text-black border-yellow-500';
      default: return 'bg-white text-slate-800 border-slate-200';
    }
  };

  const categories = ['All', 'Rings', 'Necklaces', 'Earrings', 'Bangles', 'Bracelets', 'Chains', 'Coins'];
  const statuses = ['All', 'In Stock', 'In Showcase', 'Out for Jobwork', 'Sold'];

  return (
    <div className="space-y-6">
      {/* Search and Filters panel */}
      <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU, Design Name, or Certificate number..."
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
            <Plus className="w-4.5 h-4.5" /> Add Showcase Item
          </button>
        </div>

        {/* Filters and Tags */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-y-3 justify-between">
          {/* Category tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400 mr-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Category:
            </span>
            {categories.map((cat) => (
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
                {stat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid listing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              setSelectedItem(item);
              setShowTagPreview(false);
            }}
            className="bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-amber-400/50 transition duration-250 flex flex-col group cursor-pointer"
          >
            {/* Image section with relative overlays */}
            <div className="h-44 bg-white relative overflow-hidden shrink-0">
              <img
                src={item.imageUrl}
                alt={item.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <div className="absolute bottom-3 right-3 bg-yellow-400 text-black font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                {item.metalType.replace('Gold ', '')}
              </div>
            </div>

            {/* Core Info */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold text-slate-400 uppercase leading-none mb-1.5">{item.sku}</p>
                <h4 className="font-sans font-bold text-slate-800 text-sm leading-snug truncate group-hover:text-amber-700 transition">
                  {item.name}
                </h4>
              </div>

              {/* Weights & Stone Info */}
              <div className="mt-3.5 grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block">Weights</span>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    N: {item.netWeight.toFixed(2)}g / G: {item.grossWeight.toFixed(2)}g
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block">Stones</span>
                  <span className="font-sans text-xs font-bold text-slate-800 truncate block">
                    {item.stoneType === 'None' ? 'None' : `${item.stoneType} (${item.stoneWeight}ct)`}
                  </span>
                </div>
              </div>

              {/* Valuation estimation & Action buttons */}
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Estimated Value</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    ₹{((item.netWeight * 6650) + item.stoneCharge).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    title="View Item Details"
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    title="Delete catalogue"
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center shadow-sm">
          <Gem className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-800">No catalogue items found matching query.</p>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your filters, searching another SKU, or add a new showcase item.</p>
        </div>
      )}

      {/* DETAIL VIEW & BARCODE TAG GENERATOR MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`rounded-3xl overflow-hidden border shadow-2xl w-full max-w-3xl flex flex-col md:flex-row relative transition-all duration-200 ${
            theme === 'light' ? 'bg-white border-zinc-200 text-slate-800' : 'bg-[#141416] border-zinc-800 text-zinc-100'
          }`}>
            <button
              onClick={() => setSelectedItem(null)}
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
                  <div className={`w-64 border border-dashed p-4.5 rounded-lg shadow-sm font-mono text-[10px] select-none flex flex-col justify-between h-96 transition-colors duration-200 ${
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
                        <span className="font-bold">{selectedItem.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Karat:</span>
                        <span className="font-bold">{selectedItem.metalType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Gross Wt:</span>
                        <span className="font-bold">{selectedItem.grossWeight.toFixed(2)}g</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Net Wt:</span>
                        <span className="font-bold">{selectedItem.netWeight.toFixed(2)}g</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Wastage:</span>
                        <span className="font-bold">{selectedItem.wastagePercent}%</span>
                      </div>
                      {selectedItem.stoneType !== 'None' && (
                        <div className="flex justify-between">
                          <span className={theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}>Stones:</span>
                          <span className="font-bold">{selectedItem.stoneType} ({selectedItem.stoneWeight}ct)</span>
                        </div>
                      )}
                    </div>

                    {/* Hallmarked logo mock */}
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
                          BIS HALLMARKED
                        </p>
                        <p className="text-[7px] font-mono leading-none mt-0.5" style={{ color: theme === 'light' ? '#705325' : '#D9B875' }}>
                          HUID: 9X3D8K
                        </p>
                      </div>
                    </div>

                    {/* Barcode representation */}
                    <div className={`text-center pt-2 border-t border-dashed ${theme === 'light' ? 'border-slate-200' : 'border-zinc-800'}`}>
                      <Barcode className={`w-32 h-10 mx-auto ${theme === 'light' ? 'text-slate-800' : 'text-zinc-300'}`} />
                      <p className={`text-[8px] mt-1 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>*{selectedItem.id}*</p>
                    </div>

                    <p className={`text-[7px] text-center leading-none ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>DO NOT REMOVE FROM ORNAMENT</p>
                  </div>
                </div>
              ) : (
                <div className="h-full relative min-h-[300px]">
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent p-6 flex flex-col justify-end">
                    <p className="font-mono text-xs font-bold text-amber-400 uppercase tracking-widest">{selectedItem.sku}</p>
                    <h3 className="font-sans font-black text-xl text-white tracking-tight leading-tight">{selectedItem.name}</h3>
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
                    <span className="font-bold">{selectedItem.category}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                  }`}>
                    <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                      theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                    }`}>Metal Purity</span>
                    <span className="font-bold">{selectedItem.metalType}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                  }`}>
                    <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                      theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                    }`}>Net Weight</span>
                    <span className="font-bold font-mono">{selectedItem.netWeight.toFixed(3)} grams</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                  }`}>
                    <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                      theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                    }`}>Allowed Wastage</span>
                    <span className="font-bold font-mono">{selectedItem.wastagePercent}%</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                  }`}>
                    <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                      theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                    }`}>Making Charges</span>
                    <span className="font-bold font-mono">
                      {selectedItem.makingChargeType === 'per-gram' ? `₹${selectedItem.makingChargeValue}/g` : `₹${selectedItem.makingChargeValue} Flat`}
                    </span>
                  </div>
                  <div className={`p-2.5 rounded-xl border transition-colors duration-200 ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-100'
                  }`}>
                    <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-0.5 ${
                      theme === 'light' ? 'text-slate-400' : 'text-zinc-500'
                    }`}>Certification No</span>
                    <span className="font-bold font-mono">{selectedItem.certificateNo || 'Uncertified'}</span>
                  </div>
                </div>

                {selectedItem.stoneType !== 'None' && (
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
                        {selectedItem.stoneType} ({selectedItem.stoneWeight} carat)
                      </span>
                    </div>
                    <div>
                      <span className={`block text-[10px] uppercase font-bold tracking-wider font-mono text-right mb-0.5 ${
                        theme === 'light' ? 'text-slate-400 font-medium' : 'text-zinc-500'
                      }`}>Stone Cost</span>
                      <span className={`font-bold font-mono block text-right ${theme === 'light' ? 'text-amber-800' : 'text-amber-200'}`}>
                        ₹{selectedItem.stoneCharge.toLocaleString('en-IN')}
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

      {/* ADD SHOWCASE ITEM DIALOG MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Gem className="w-5 h-5 text-amber-500" />
                <h3 className="font-sans font-bold text-slate-900 text-lg">Intake New Showcase Ornament</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">SKU Tag *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RNG-22K-084"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Category *</label>
                  <select
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value as any })}
                  >
                    <option value="Rings">Rings</option>
                    <option value="Necklaces">Necklaces</option>
                    <option value="Earrings">Earrings</option>
                    <option value="Bangles">Bangles</option>
                    <option value="Bracelets">Bracelets</option>
                    <option value="Chains">Chains</option>
                    <option value="Coins">Coins</option>
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
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Metal Standard *</label>
                  <select
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                    value={newItem.metalType}
                    onChange={(e) => setNewItem({ ...newItem, metalType: e.target.value as any })}
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
                    value={newItem.certificateNo}
                    onChange={(e) => setNewItem({ ...newItem, certificateNo: e.target.value })}
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
                    value={newItem.grossWeight || ''}
                    onChange={(e) => setNewItem({ ...newItem, grossWeight: parseFloat(e.target.value) })}
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
                    value={newItem.netWeight || ''}
                    onChange={(e) => setNewItem({ ...newItem, netWeight: parseFloat(e.target.value) })}
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
                    value={newItem.wastagePercent ?? 3}
                    onChange={(e) => setNewItem({ ...newItem, wastagePercent: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Making Type *</label>
                  <select
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                    value={newItem.makingChargeType}
                    onChange={(e) => setNewItem({ ...newItem, makingChargeType: e.target.value as any })}
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
                    value={newItem.makingChargeValue || ''}
                    onChange={(e) => setNewItem({ ...newItem, makingChargeValue: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-150">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Stone Detail</label>
                  <select
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-250 bg-white rounded-md focus:outline-none"
                    value={newItem.stoneType}
                    onChange={(e) => setNewItem({ ...newItem, stoneType: e.target.value as any })}
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
                    disabled={newItem.stoneType === 'None'}
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-250 rounded-md focus:outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    value={newItem.stoneWeight || ''}
                    onChange={(e) => setNewItem({ ...newItem, stoneWeight: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Charges (₹)</label>
                  <input
                    type="number"
                    disabled={newItem.stoneType === 'None'}
                    placeholder="0"
                    className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-250 rounded-md focus:outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    value={newItem.stoneCharge || ''}
                    onChange={(e) => setNewItem({ ...newItem, stoneCharge: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Photo URL (Stock Illustration)</label>
                <input
                  type="text"
                  placeholder="Paste direct URL or leave empty for dynamic stock image"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                  value={newItem.imageUrl}
                  onChange={(e) => setNewItem({ ...newItem, imageUrl: e.target.value })}
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
  );
}
