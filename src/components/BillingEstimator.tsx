import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  User, 
  Plus, 
  Trash2, 
  Calculator, 
  Coins, 
  TrendingDown, 
  Printer, 
  ShoppingBag,
  CheckCircle,
  FileCheck,
  Search,
  Percent,
  Eye,
  AlertCircle,
  Calendar,
  Users,
  Sparkles
} from 'lucide-react';
import { Tag, Customer, SaleInvoice, InvoiceItem } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { calculateLineItem, calculateInvoiceTotals, settleOldGold } from '../lib/billingCalculations';

interface BillingEstimatorProps {
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  metalRates: { metalType: string; ratePerGram: number }[];
  invoices: SaleInvoice[];
  setInvoices: React.Dispatch<React.SetStateAction<SaleInvoice[]>>;
}

/** Gap-free, session-persistent invoice number sequence (fixes KNOWN_ISSUES.md #11). */
function nextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const key = `stitch_invoice_seq_${year}`;
  const next = Number(localStorage.getItem(key) || '1000') + 1;
  localStorage.setItem(key, String(next));
  return `INV-${year}-${next}`;
}

export default function BillingEstimator({
  tags,
  setTags,
  customers,
  setCustomers,
  metalRates,
  invoices,
  setInvoices
}: BillingEstimatorProps) {
  // Available stock in showroom
  const availableStock = tags.filter(i => i.status === 'In Stock' || i.status === 'In Showcase');

  const { theme } = useTheme();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'create' | 'registry'>('create');

  // Sync tab with URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'history') {
      setActiveTab('registry');
    }
  }, [window.location.search]);

  // Invoice History Search & Registry
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<SaleInvoice | null>(null);

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);

  // Transaction state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  
  // Invoice items being billed
  const emptyBillingItem: Partial<InvoiceItem> = {
    name: '', metalType: 'Gold (22K)', netWeight: 0, wastagePercent: 0,
    makingChargeType: 'per-gram', makingChargeValue: 0, makingCharge: 0, stoneCharge: 0, subtotal: 0
  };
  const [billingItems, setBillingItems] = useState<Partial<InvoiceItem>[]>([{ ...emptyBillingItem }]);

  // Scrap / Old Gold trade-in
  const [oldGoldWeight, setOldGoldWeight] = useState<number>(0);
  const [oldGoldPurity, setOldGoldPurity] = useState<string>('22K');
  const [oldGoldRate, setOldGoldRate] = useState<number>(5500); // reduced trade rate

  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Scheme Redemption'>('UPI');

  // Success screen
  const [completedInvoice, setCompletedInvoice] = useState<SaleInvoice | null>(null);

  // Search catalog helper
  const [selectedStockId, setSelectedStockId] = useState<string>('');

  // Calculate price per gram helper
  const getMetalRate = (metalType: string) => {
    const rate = metalRates.find(r => r.metalType === metalType);
    return rate ? rate.ratePerGram : 0;
  };

  // Recalculate a billing line's Metal/Wastage/Making/Stone breakdown (PRD §7.2)
  const calculateItemSubtotal = (item: Partial<InvoiceItem>) => {
    const rate = getMetalRate(item.metalType || 'Gold (22K)');
    return calculateLineItem({
      netWeight: Number(item.netWeight || 0),
      metalRate: rate,
      wastagePercent: Number(item.wastagePercent || 0),
      makingChargeType: item.makingChargeType === 'flat' ? 'flat' : 'per-gram',
      makingChargeValue: Number(item.makingChargeValue || 0),
      stoneCharge: Number(item.stoneCharge || 0)
    });
  };

  const handleStockSelection = (stockId: string) => {
    if (!stockId) return;
    const stockItem = availableStock.find(i => i.id === stockId);
    if (!stockItem) return;

    // Replace the last empty or new item, or add to list
    const updated = [...billingItems];
    const lastItemIdx = updated.length - 1;

    const billingItem: Partial<InvoiceItem> = {
      itemId: stockItem.id,
      sku: stockItem.sku,
      name: stockItem.name,
      metalType: stockItem.metalType,
      netWeight: stockItem.netWeight,
      wastagePercent: stockItem.wastagePercent,
      makingChargeType: stockItem.makingChargeType,
      makingChargeValue: stockItem.makingChargeValue,
      stoneCharge: stockItem.stoneCharge,
    };

    const calculated = calculateItemSubtotal(billingItem);
    billingItem.goldPrice = calculated.metalValue;
    billingItem.wastageValue = calculated.wastageValue;
    billingItem.makingCharge = calculated.makingCharge;
    billingItem.subtotal = calculated.subtotal;

    if (updated[lastItemIdx]?.name === '' && updated[lastItemIdx]?.netWeight === 0) {
      updated[lastItemIdx] = billingItem;
    } else {
      updated.push(billingItem);
    }

    setBillingItems(updated);
    setSelectedStockId('');
  };

  const updateItemField = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...billingItems];
    updated[index] = { ...updated[index], [field]: value };

    // Trigger recalculation for this item
    const calculated = calculateItemSubtotal(updated[index]);
    updated[index].goldPrice = calculated.metalValue;
    updated[index].wastageValue = calculated.wastageValue;
    updated[index].makingCharge = calculated.makingCharge;
    updated[index].subtotal = calculated.subtotal;

    setBillingItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = billingItems.filter((_, i) => i !== index);
    setBillingItems(updated.length > 0 ? updated : [{ ...emptyBillingItem }]);
  };

  const handleAddItemRow = () => {
    setBillingItems([...billingItems, { ...emptyBillingItem }]);
  };

  // Summary Calculations (PRD §7.3 / §17 — GST is computed on the full taxable
  // subtotal and is NEVER reduced by the old-gold trade-in; old gold is netted
  // only against the final payable amount at settlement — KNOWN_ISSUES.md #1)
  const lineSubtotals = billingItems.map(item => item.subtotal || 0);
  const { subtotal: invoiceSubtotal, gstTax, grandTotal: invoiceTotal } = calculateInvoiceTotals(lineSubtotals, discount);
  const oldGoldValue = Math.round(oldGoldWeight * oldGoldRate);
  const netAmountDue = settleOldGold(invoiceTotal, oldGoldValue);
  const finalGrandTotal = netAmountDue; // actual amount collected from the customer, after old-gold settlement

  const handleCheckout = () => {
    setValidationError(null);

    // Filter out rows that are completely empty
    const filledItems = billingItems.filter(item => {
      const hasName = !!item.name?.trim();
      const hasWeight = Number(item.netWeight || 0) > 0;
      return hasName || hasWeight;
    });

    if (filledItems.length === 0) {
      setValidationError("Please add at least one item with a valid name or weight.");
      return;
    }

    // Scheme Redemption must validate against and deduct from the customer's
    // actual savings balance — previously a purely cosmetic label (KNOWN_ISSUES.md #5)
    if (paymentMethod === 'Scheme Redemption') {
      if (!selectedCustomer || !selectedCustomer.savingsSchemeActive) {
        setValidationError("Scheme Redemption requires a CRM customer with an active Gold Savings Scheme.");
        return;
      }
      if (finalGrandTotal > (selectedCustomer.savingsSchemeBalance || 0)) {
        setValidationError(`Scheme balance (₹${(selectedCustomer.savingsSchemeBalance || 0).toLocaleString('en-IN')}) is insufficient to cover the amount due (₹${finalGrandTotal.toLocaleString('en-IN')}).`);
        return;
      }
    }

    const customerName = selectedCustomer ? selectedCustomer.name : guestName.trim() || 'Guest Walk-in';
    const customerPhone = selectedCustomer ? selectedCustomer.phone : guestPhone.trim() || 'N/A';

    const processedItems = filledItems.map(item => {
      const name = item.name?.trim() || `${item.metalType || 'Gold'} Showroom Ornament`;
      return {
        itemId: item.itemId,
        sku: item.sku,
        name,
        metalType: item.metalType || 'Gold (22K)',
        netWeight: Number(item.netWeight || 0),
        wastagePercent: Number(item.wastagePercent || 0),
        makingChargeType: (item.makingChargeType === 'flat' ? 'flat' : 'per-gram') as 'flat' | 'per-gram',
        makingChargeValue: Number(item.makingChargeValue || 0),
        goldPrice: Number(item.goldPrice || 0),
        wastageValue: Number(item.wastageValue || 0),
        makingCharge: Number(item.makingCharge || 0),
        stoneCharge: Number(item.stoneCharge || 0),
        subtotal: Number(item.subtotal || 0)
      };
    });

    const invoice: SaleInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: nextInvoiceNumber(),
      date: new Date().toISOString().split('T')[0],
      customerId: selectedCustomer?.id,
      customerName,
      customerPhone,
      items: processedItems,
      oldGoldWeight,
      oldGoldValue,
      subtotal: invoiceSubtotal,
      tax: gstTax,
      discount,
      grandTotal: invoiceTotal,
      netAmountDue: finalGrandTotal,
      paymentMethod
    };

    // Update state
    setInvoices(prev => [invoice, ...prev]);

    // Mark catalogue tags in stock as "Sold"
    const soldTagIds = processedItems.map(i => i.itemId).filter(id => id !== undefined) as string[];
    if (soldTagIds.length > 0) {
      setTags(prev => prev.map(tag => {
        if (soldTagIds.includes(tag.id)) {
          return { ...tag, status: 'Sold' };
        }
        return tag;
      }));
    }

    // Deduct the redeemed amount from the customer's scheme balance
    if (paymentMethod === 'Scheme Redemption' && selectedCustomer) {
      setCustomers(prev => prev.map(c =>
        c.id === selectedCustomer.id
          ? { ...c, savingsSchemeBalance: (c.savingsSchemeBalance || 0) - finalGrandTotal }
          : c
      ));
    }

    // Set completed invoice for receipt presentation
    setCompletedInvoice(invoice);
  };

  const handleResetBilling = () => {
    setBillingItems([{ ...emptyBillingItem }]);
    setSelectedCustomer(null);
    setGuestName('');
    setGuestPhone('');
    setOldGoldWeight(0);
    setDiscount(0);
    setCompletedInvoice(null);
    setValidationError(null);
  };

  // Statistics for Registry
  const totalInvoicesCount = invoices.length;
  const totalInvoicesValue = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const totalOldGoldWeight = invoices.reduce((sum, inv) => sum + inv.oldGoldWeight, 0);
  const uniqueCustomersCount = new Set(invoices.map(inv => inv.customerName)).size;

  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.customerPhone.toLowerCase().includes(q) ||
      inv.items.some(item => item.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      {/* Top Tab Bar (Hidden in print mode) */}
      {!completedInvoice && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 pb-px gap-6 items-center print:hidden">
          <button
            onClick={() => {
              setActiveTab('create');
              window.history.replaceState({}, '', '/billing');
            }}
            className={`pb-3 text-sm font-bold transition relative cursor-pointer ${
              activeTab === 'create'
                ? 'text-amber-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            POS Invoice Desk
            {activeTab === 'create' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('registry');
              window.history.replaceState({}, '', '/billing?tab=history');
            }}
            className={`pb-3 text-sm font-bold transition relative cursor-pointer ${
              activeTab === 'registry'
                ? 'text-amber-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Sales Invoices Registry
            {activeTab === 'registry' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>
        </div>
      )}

      {completedInvoice ? (
        /* PRINTABLE INVOICE RECEIPT SCREEN */
        <div className="bg-white border border-slate-150 p-8 rounded-3xl shadow-lg max-w-2xl mx-auto space-y-6 relative text-slate-800">
          <div className="absolute top-6 right-6 flex gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print Invoice
            </button>
            <button
              onClick={handleResetBilling}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition cursor-pointer"
            >
              New Bill
            </button>
            <button
              onClick={() => {
                handleResetBilling();
                setActiveTab('registry');
                window.history.replaceState({}, '', '/billing?tab=history');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition cursor-pointer"
            >
              View Registry
            </button>
          </div>

          {/* Core Printable Tax Invoice */}
          <div className="space-y-6 pt-6 print:pt-0" id="print-area">
            {/* Header */}
            <div className="text-center border-b pb-4 space-y-1">
              <h1 className="font-sans font-black text-2xl tracking-wider text-slate-900">STITCH JEWELLERY HOUSE</h1>
              <p className="text-xs text-slate-500">102, Gold Palace Plaza, Zaveri Bazaar, Mumbai, MH - 400002</p>
              <p className="text-[10px] font-mono text-slate-400">Tel: +91 22 2240 8710 | GSTIN: 27AACCS9948H1Z1</p>
              <h2 className="text-xs uppercase font-bold bg-slate-100 py-1 tracking-widest text-slate-700 rounded mt-3">TAX INVOICE</h2>
            </div>

            {/* Info details */}
            <div className="grid grid-cols-2 text-xs font-medium text-slate-600 gap-y-2">
              <div>
                <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Invoice Number:</span></p>
                <p className="font-mono font-bold text-slate-900 text-sm">{completedInvoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Date:</span></p>
                <p className="font-mono text-slate-900">{completedInvoice.date}</p>
              </div>
              <div>
                <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Billed To:</span></p>
                <p className="font-bold text-slate-900">{completedInvoice.customerName}</p>
                <p className="font-mono text-slate-500">{completedInvoice.customerPhone}</p>
              </div>
              <div className="text-right">
                <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Cashier / Operator:</span></p>
                <p className="font-bold text-slate-900">Prathamesh S.</p>
                <p className="font-mono text-slate-500">Counter Terminal #1</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="border-t border-b py-2">
              <table className="w-full text-left text-xs font-medium">
                <thead>
                  <tr className="text-slate-400 uppercase font-mono text-[9px] border-b pb-2">
                    <th className="py-2">Item Description</th>
                    <th>Standard</th>
                    <th className="text-right">Net Wt</th>
                    <th className="text-right">Metal Rate</th>
                    <th className="text-right">Wastage + MC + Stones</th>
                    <th className="text-right py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-800">
                  {completedInvoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3">
                        <p className="font-bold text-slate-900">{item.name}</p>
                        {item.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>}
                      </td>
                      <td className="font-mono text-slate-500">{item.metalType}</td>
                      <td className="text-right font-mono">{item.netWeight.toFixed(2)} g</td>
                      <td className="text-right font-mono">₹{item.goldPrice ? Math.round(item.goldPrice / item.netWeight).toLocaleString('en-IN') : '-'}</td>
                      <td className="text-right font-mono">₹{(item.wastageValue + item.makingCharge + item.stoneCharge).toLocaleString('en-IN')}</td>
                      <td className="text-right font-mono font-bold text-slate-900 py-3">₹{item.subtotal.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Price Calculations breakdown */}
            <div className="w-1/2 ml-auto text-xs font-medium space-y-2">
              <div className="flex justify-between text-slate-500">
                <span>Taxable Subtotal:</span>
                <span className="font-mono">₹{completedInvoice.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Jewelry GST (3%):</span>
                <span className="font-mono">₹{completedInvoice.tax.toLocaleString('en-IN')}</span>
              </div>
              {completedInvoice.discount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Discount Code Applied:</span>
                  <span className="font-mono">-₹{completedInvoice.discount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-slate-900 border-t-2 pt-2 text-sm bg-amber-50 px-2 py-1.5 rounded">
                <span>Invoice Total (Tax Invoice):</span>
                <span className="font-mono text-amber-800">₹{completedInvoice.grandTotal.toLocaleString('en-IN')}</span>
              </div>
              {completedInvoice.oldGoldWeight > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded">
                  <span>Less: Old Gold Buyback ({completedInvoice.oldGoldWeight}g, settlement only):</span>
                  <span className="font-mono">-₹{completedInvoice.oldGoldValue.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-slate-900 border-t-2 pt-2 text-sm bg-amber-50 px-2 py-1.5 rounded">
                <span>Net Amount Due:</span>
                <span className="font-mono text-amber-800">₹{completedInvoice.netAmountDue.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Hallmark Warranty declaration */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 text-[10px] text-slate-500 space-y-1.5">
              <p className="font-bold text-slate-700 flex items-center gap-1">
                <FileCheck className="w-4 h-4 text-amber-600" /> BIS Hallmark & Quality Warranty
              </p>
              <p>Certified that all gold items listed are BIS Hallmarked with HUID values. Diamonds are verified with IGI/GIA certifications. Returns/Buybacks are accepted on prevailing market rates subject to standard melting purity tests.</p>
            </div>

            {/* Signature fields */}
            <div className="grid grid-cols-2 pt-10 text-center text-[10px] font-semibold text-slate-400">
              <div>
                <p className="border-t border-slate-200 pt-2 w-32 mx-auto">Customer Signature</p>
              </div>
              <div>
                <p className="border-t border-slate-200 pt-2 w-32 mx-auto">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'create' ? (
        /* STANDARD CALCULATION SHEET */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer & Item list */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Attachment Section */}
            <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <User className="w-5 h-5 text-amber-600" />
                <h3 className="font-sans font-bold text-slate-800 text-sm">Customer Attachment</h3>
              </div>

              {/* CRM selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Select CRM Customer</label>
                  <select
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                    value={selectedCustomer?.id || ''}
                    onChange={(e) => {
                      const cust = customers.find(c => c.id === e.target.value);
                      setSelectedCustomer(cust || null);
                    }}
                  >
                    <option value="">-- Walk-in Guest (Enter manually below) --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) - {c.tier} Tier
                      </option>
                    ))}
                  </select>
                </div>

                {/* If guest manual entry */}
                {!selectedCustomer && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Guest Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Guest Phone</label>
                      <input
                        type="text"
                        placeholder="9876543210"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {selectedCustomer && (
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Loyalty Wallet</span>
                      <p className="font-bold text-amber-800">{selectedCustomer.loyaltyPoints} points available</p>
                    </div>
                    {selectedCustomer.savingsSchemeActive && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Gold Scheme Balance</span>
                        <p className="font-bold text-emerald-800">₹{selectedCustomer.savingsSchemeBalance?.toLocaleString('en-IN')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Billing Section */}
            <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-600" />
                  <h3 className="font-sans font-bold text-slate-800 text-sm">Ornaments to Invoice</h3>
                </div>

                {/* Showroom Stock Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Pull Stock:</span>
                  <select
                    className="text-xs px-3 py-1.5 border border-slate-200 bg-amber-50 text-amber-900 font-semibold rounded-lg focus:outline-none focus:border-amber-500 max-w-[200px]"
                    value={selectedStockId}
                    onChange={(e) => handleStockSelection(e.target.value)}
                  >
                    <option value="">-- Choose Showroom Item --</option>
                    {availableStock.map(item => (
                      <option key={item.id} value={item.id}>
                        [{item.sku}] {item.name} ({item.netWeight}g)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List Rows */}
              <div className="space-y-4">
                {billingItems.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-50/50 rounded-xl border border-slate-150 space-y-3 relative group/row">
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover/row:opacity-100 transition"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Top Row: Description */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ornament Description</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Handmade Filigree Ring"
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.name}
                          onChange={(e) => updateItemField(index, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Metal Standard</label>
                        <select
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 bg-white rounded-md focus:outline-none focus:border-amber-500"
                          value={item.metalType}
                          onChange={(e) => updateItemField(index, 'metalType', e.target.value as any)}
                        >
                          <option value="Gold (24K)">Gold (24K)</option>
                          <option value="Gold (22K)">Gold (22K)</option>
                          <option value="Gold (18K)">Gold (18K)</option>
                          <option value="Silver (999)">Silver (999)</option>
                          <option value="Platinum (950)">Platinum (950)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Net Weight (g)</label>
                        <input
                          type="number"
                          step="0.001"
                          required
                          placeholder="0.00"
                          className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.netWeight || ''}
                          onChange={(e) => updateItemField(index, 'netWeight', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {/* Middle Row: Wastage & Making Charge inputs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Wastage %</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.wastagePercent || ''}
                          onChange={(e) => updateItemField(index, 'wastagePercent', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Making Charge Type</label>
                        <select
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 bg-white rounded-md focus:outline-none focus:border-amber-500"
                          value={item.makingChargeType || 'per-gram'}
                          onChange={(e) => updateItemField(index, 'makingChargeType', e.target.value as any)}
                        >
                          <option value="per-gram">Per Gram</option>
                          <option value="flat">Flat / Piece</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Making Charge {item.makingChargeType === 'flat' ? '(Flat ₹)' : '(₹/g)'}
                        </label>
                        <input
                          type="number"
                          placeholder="₹400"
                          className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.makingChargeValue || ''}
                          onChange={(e) => updateItemField(index, 'makingChargeValue', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stones Charge (₹)</label>
                        <input
                          type="number"
                          placeholder="₹0"
                          className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.stoneCharge || ''}
                          onChange={(e) => updateItemField(index, 'stoneCharge', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {/* Bottom Row: Computed breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-amber-50/40 border border-amber-100 p-2.5 rounded-md flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Metal Value</span>
                        <span className="font-mono text-xs font-bold text-amber-800">
                          ₹{(item.goldPrice || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="bg-amber-50/40 border border-amber-100 p-2.5 rounded-md flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Wastage Value</span>
                        <span className="font-mono text-xs font-bold text-amber-800">
                          ₹{(item.wastageValue || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="bg-amber-50/40 border border-amber-100 p-2.5 rounded-md flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Making Charge</span>
                        <span className="font-mono text-xs font-bold text-amber-800">
                          ₹{(item.makingCharge || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="bg-amber-100/50 p-2.5 rounded-md flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Line Item Value</span>
                        <span className="font-mono text-xs font-black text-slate-900">
                          ₹{(item.subtotal || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add row triggers */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100/80 px-4 py-2.5 rounded-xl transition"
                >
                  <Plus className="w-4 h-4" /> Add Custom Item Row
                </button>
              </div>
            </div>

            {/* Scrap Gold Buyback / Exchange Section */}
            <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Coins className="w-5 h-5 text-amber-600" />
                <h3 className="font-sans font-bold text-slate-800 text-sm">Old Gold Trade-in Buyback (Deduction Credit)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Old Weight (g)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    value={oldGoldWeight || ''}
                    onChange={(e) => setOldGoldWeight(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Stated Purity</label>
                  <select
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-white"
                    value={oldGoldPurity}
                    onChange={(e) => {
                      setOldGoldPurity(e.target.value);
                      if (e.target.value === '22K') setOldGoldRate(5500);
                      else if (e.target.value === '24K') setOldGoldRate(6200);
                      else setOldGoldRate(4200);
                    }}
                  >
                    <option value="24K">Old Gold (24K) - Melt valuation</option>
                    <option value="22K">Old Gold (22K) - 916 Scrap</option>
                    <option value="18K">Old Gold (18K) - Standard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Trade valuation / g (₹)</label>
                  <input
                    type="number"
                    placeholder="₹5500"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    value={oldGoldRate || ''}
                    onChange={(e) => setOldGoldRate(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {oldGoldWeight > 0 && (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-150 flex justify-between items-center text-xs">
                  <span className="font-medium text-emerald-800">Total Trade-in credit value:</span>
                  <span className="font-mono font-black text-emerald-800">-₹{oldGoldValue.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Checkout Invoice calculations */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-sm space-y-5 sticky top-6">
              <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-slate-800" />
                <h3 className="font-sans font-bold text-slate-800 text-sm">Invoice Calculation Sheet</h3>
              </div>

              {/* Items value subtotal — GST is computed on this in full; old gold
                  NEVER reduces the taxable base (PRD §8.3 / KNOWN_ISSUES.md #1) */}
              <div className="space-y-2.5 text-xs font-medium">
                <div className="flex justify-between text-slate-500">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono">₹{invoiceSubtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1">GST/Taxes (3%): <Percent className="w-3 h-3 text-slate-400" /></span>
                  <span className="font-mono">₹{gstTax.toLocaleString('en-IN')}</span>
                </div>

                {/* Discount input */}
                <div className="pt-2 border-t flex gap-2">
                  <input
                    type="number"
                    placeholder="Discounts/Vouchers (₹)"
                    className="w-full text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                    value={discount || ''}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="flex justify-between text-slate-700 border-t pt-2.5 font-bold">
                  <span>Invoice Total (Tax Invoice):</span>
                  <span className="font-mono">₹{invoiceTotal.toLocaleString('en-IN')}</span>
                </div>

                {oldGoldWeight > 0 && (
                  <div className="flex justify-between text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">
                    <span>Less: Old Gold Buyback (settlement):</span>
                    <span className="font-mono">-₹{oldGoldValue.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              {/* Net Amount Due */}
              <div className="bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Net Amount Due</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-bold font-mono text-amber-400">₹{finalGrandTotal.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-slate-400">after old-gold settlement</span>
                </div>
              </div>

              {/* Payment selection */}
              <div className="space-y-2">
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-400">Payment Channel</label>
                <div className="grid grid-cols-2 gap-2">
                  {['UPI', 'Cash', 'Card', 'Scheme Redemption'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPaymentMethod(mode as any)}
                      className={`text-xs py-2 rounded-xl border text-center font-bold transition ${
                        paymentMethod === mode
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inline Validation Alert */}
              {validationError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs rounded-xl border border-rose-100 dark:border-rose-900/50 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 animate-bounce" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Action */}
              <button
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-3 rounded-2xl shadow-lg shadow-amber-500/10 transition duration-150 uppercase tracking-wider cursor-pointer"
              >
                <Receipt className="w-4.5 h-4.5 text-slate-950" /> Generate Formal Invoice
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* SALES INVOICE REGISTRY & HISTORY TAB */
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Billed Customers</p>
                <p className="text-xl font-bold font-mono text-amber-400">{uniqueCustomersCount}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Total Invoices</p>
                <p className="text-xl font-bold font-mono text-amber-400">{totalInvoicesCount}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Total Sales Value</p>
                <p className="text-xl font-bold font-mono text-amber-400">₹{totalInvoicesValue.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Old Gold Received</p>
                <p className="text-xl font-bold font-mono text-amber-400">{totalOldGoldWeight.toFixed(2)} g</p>
              </div>
            </div>
          </div>

          {/* Search Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-sans font-bold text-slate-800 dark:text-slate-100 text-sm">Billing Registry & History</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Search, filter, and view details of generated jeweler bills.</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice, customer, phone..."
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white rounded-lg focus:outline-none focus:border-amber-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 uppercase font-mono text-[9px] border-b border-slate-100 dark:border-slate-800 pb-2">
                    <th className="py-3">Invoice Number</th>
                    <th>Date</th>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Payment</th>
                    <th className="text-right">Grand Total</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-mono">
                        No invoices found matching query.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-4 font-mono font-bold text-amber-600 dark:text-amber-500">{inv.invoiceNumber}</td>
                        <td className="font-mono text-slate-500 dark:text-slate-400">{inv.date}</td>
                        <td className="font-bold text-slate-900 dark:text-slate-100">{inv.customerName}</td>
                        <td className="font-mono text-slate-500 dark:text-slate-400">{inv.customerPhone}</td>
                        <td>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {inv.paymentMethod}
                          </span>
                        </td>
                        <td className="text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ₹{inv.grandTotal.toLocaleString('en-IN')}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => setSelectedInvoiceForDetail(inv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 dark:bg-amber-600/20 dark:hover:bg-amber-600/40 text-slate-950 dark:text-amber-400 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> View Bill
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Backdrop Modal */}
      {selectedInvoiceForDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-150 p-8 rounded-3xl shadow-2xl max-w-2xl w-full relative my-8 text-slate-800">
            <div className="absolute top-6 right-6 flex gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-lg transition cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Invoice
              </button>
              <button
                onClick={() => setSelectedInvoiceForDetail(null)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Core Printable Tax Invoice */}
            <div className="space-y-6 pt-6 print:pt-0" id="print-area">
              {/* Header */}
              <div className="text-center border-b pb-4 space-y-1">
                <h1 className="font-sans font-black text-2xl tracking-wider text-slate-900">STITCH JEWELLERY HOUSE</h1>
                <p className="text-xs text-slate-500">102, Gold Palace Plaza, Zaveri Bazaar, Mumbai, MH - 400002</p>
                <p className="text-[10px] font-mono text-slate-400">Tel: +91 22 2240 8710 | GSTIN: 27AACCS9948H1Z1</p>
                <h2 className="text-xs uppercase font-bold bg-slate-100 py-1 tracking-widest text-slate-700 rounded mt-3">TAX INVOICE</h2>
              </div>

              {/* Info details */}
              <div className="grid grid-cols-2 text-xs font-medium text-slate-600 gap-y-2">
                <div>
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Invoice Number:</span></p>
                  <p className="font-mono font-bold text-slate-900 text-sm">{selectedInvoiceForDetail.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Date:</span></p>
                  <p className="font-mono text-slate-900">{selectedInvoiceForDetail.date}</p>
                </div>
                <div>
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Billed To:</span></p>
                  <p className="font-bold text-slate-900">{selectedInvoiceForDetail.customerName}</p>
                  <p className="font-mono text-slate-500">{selectedInvoiceForDetail.customerPhone}</p>
                </div>
                <div className="text-right">
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Cashier / Operator:</span></p>
                  <p className="font-bold text-slate-900">Prathamesh S.</p>
                  <p className="font-mono text-slate-500">Counter Terminal #1</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-t border-b py-2">
                <table className="w-full text-left text-xs font-medium">
                  <thead>
                    <tr className="text-slate-400 uppercase font-mono text-[9px] border-b pb-2">
                      <th className="py-2">Item Description</th>
                      <th>Standard</th>
                      <th className="text-right">Net Wt</th>
                      <th className="text-right">Metal Rate</th>
                      <th className="text-right">Wastage + MC + Stones</th>
                      <th className="text-right py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-slate-800">
                    {selectedInvoiceForDetail.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          {item.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>}
                        </td>
                        <td className="font-mono text-slate-500">{item.metalType}</td>
                        <td className="text-right font-mono">{item.netWeight.toFixed(2)} g</td>
                        <td className="text-right font-mono">₹{item.goldPrice ? Math.round(item.goldPrice / item.netWeight).toLocaleString('en-IN') : '-'}</td>
                        <td className="text-right font-mono">₹{(item.wastageValue + item.makingCharge + item.stoneCharge).toLocaleString('en-IN')}</td>
                        <td className="text-right font-mono font-bold text-slate-900 py-3">₹{item.subtotal.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Price Calculations breakdown */}
              <div className="w-1/2 ml-auto text-xs font-medium space-y-2">
                <div className="flex justify-between text-slate-500">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono">₹{selectedInvoiceForDetail.subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Jewelry GST (3%):</span>
                  <span className="font-mono">₹{selectedInvoiceForDetail.tax.toLocaleString('en-IN')}</span>
                </div>
                {selectedInvoiceForDetail.discount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Discount Code Applied:</span>
                    <span className="font-mono">-₹{selectedInvoiceForDetail.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 border-t-2 pt-2 text-sm bg-amber-50 px-2 py-1.5 rounded">
                  <span>Invoice Total (Tax Invoice):</span>
                  <span className="font-mono text-amber-800 font-bold">₹{selectedInvoiceForDetail.grandTotal.toLocaleString('en-IN')}</span>
                </div>
                {selectedInvoiceForDetail.oldGoldWeight > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded">
                    <span>Less: Old Gold Buyback ({selectedInvoiceForDetail.oldGoldWeight}g, settlement only):</span>
                    <span className="font-mono">-₹{selectedInvoiceForDetail.oldGoldValue.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 border-t-2 pt-2 text-sm bg-amber-50 px-2 py-1.5 rounded">
                  <span>Net Amount Due:</span>
                  <span className="font-mono text-amber-800 font-bold">₹{selectedInvoiceForDetail.netAmountDue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Hallmark Warranty declaration */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 text-[10px] text-slate-500 space-y-1.5">
                <p className="font-bold text-slate-700 flex items-center gap-1">
                  <FileCheck className="w-4 h-4 text-amber-600" /> BIS Hallmark & Quality Warranty
                </p>
                <p>Certified that all gold items listed are BIS Hallmarked with HUID values. Diamonds are verified with IGI/GIA certifications. Returns/Buybacks are accepted on prevailing market rates subject to standard melting purity tests.</p>
              </div>

              {/* Signature fields */}
              <div className="grid grid-cols-2 pt-10 text-center text-[10px] font-semibold text-slate-400">
                <div>
                  <p className="border-t border-slate-200 pt-2 w-32 mx-auto">Customer Signature</p>
                </div>
                <div>
                  <p className="border-t border-slate-200 pt-2 w-32 mx-auto">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
