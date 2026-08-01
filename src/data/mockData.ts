import { ItemDesign, Tag, Customer, Karigar, JobWork, SaleInvoice, MetalRate, LooseStone, OldGoldVoucher, KarigarLedgerEntry, Branch, TaxRate, SavingsScheme, SchemeEnrollment, SchemeInstalment, Supplier, PurchaseOrder } from '../types';

export const initialMetalRates: MetalRate[] = [
  {
    id: 'rate-1',
    metalType: 'Gold (24K)',
    purity: '99.9%',
    ratePerGram: 7250,
    change24h: 0.85,
    history24h: [7180, 7200, 7190, 7220, 7210, 7240, 7230, 7250]
  },
  {
    id: 'rate-2',
    metalType: 'Gold (22K)',
    purity: '91.6%',
    ratePerGram: 6650,
    change24h: 0.72,
    history24h: [6590, 6610, 6600, 6620, 6615, 6640, 6630, 6650]
  },
  {
    id: 'rate-3',
    metalType: 'Gold (18K)',
    purity: '75.0%',
    ratePerGram: 5440,
    change24h: -0.21,
    history24h: [5480, 5470, 5460, 5450, 5455, 5445, 5450, 5440]
  },
  {
    id: 'rate-4',
    metalType: 'Silver (999)',
    purity: '99.9%',
    ratePerGram: 92,
    change24h: 1.45,
    history24h: [89, 90, 89.5, 91, 90.8, 91.5, 91.2, 92]
  },
  {
    id: 'rate-5',
    metalType: 'Platinum (950)',
    purity: '95.0%',
    ratePerGram: 3250,
    change24h: 0.15,
    history24h: [3240, 3245, 3235, 3250, 3242, 3248, 3245, 3250]
  }
];

// Design templates (PRD §4.3, Handbook Phase 2 §2.5) — category/metal/defaults/images only,
// never actual weight or stock status. Each design below is instantiated by exactly one Tag
// in this seed data, but a real catalog would tag many physical pieces per design over time.
export const initialItemDesigns: ItemDesign[] = [
  {
    id: 'design-1',
    designCode: 'RNG-22K-001',
    name: 'Antique Peacock Royal Ring',
    category: 'Rings',
    metalType: 'Gold (22K)',
    defaultWastagePercent: 3.5,
    defaultMakingChargeType: 'per-gram',
    defaultMakingChargeValue: 450,
    defaultStoneType: 'Ruby',
    hsnCode: '7113',
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'design-2',
    designCode: 'NEC-22K-042',
    name: 'Temple Heritage Kundan Choker',
    category: 'Necklaces',
    metalType: 'Gold (22K)',
    defaultWastagePercent: 5.0,
    defaultMakingChargeType: 'per-gram',
    defaultMakingChargeValue: 650,
    defaultStoneType: 'Cubic Zirconia',
    hsnCode: '7113',
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'design-3',
    designCode: 'EAR-18K-109',
    name: 'Solitaire Halo Diamond Studs',
    category: 'Earrings',
    metalType: 'Gold (18K)',
    defaultWastagePercent: 2.0,
    defaultMakingChargeType: 'flat',
    defaultMakingChargeValue: 2500,
    defaultStoneType: 'Diamond',
    hsnCode: '7113',
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'design-4',
    designCode: 'BGL-22K-081',
    name: 'Bridal Filigree Kada Bangles (Pair)',
    category: 'Bangles',
    metalType: 'Gold (22K)',
    defaultWastagePercent: 4.0,
    defaultMakingChargeType: 'per-gram',
    defaultMakingChargeValue: 500,
    defaultStoneType: 'None',
    hsnCode: '7113',
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'design-5',
    designCode: 'NEC-18K-005',
    name: 'Modernist Diamond Drop Pendant',
    category: 'Necklaces',
    metalType: 'Gold (18K)',
    defaultWastagePercent: 3.0,
    defaultMakingChargeType: 'per-gram',
    defaultMakingChargeValue: 550,
    defaultStoneType: 'Diamond',
    hsnCode: '7113',
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'design-6',
    designCode: 'RNG-SLV-002',
    name: 'Classic Vintage Marquise Silver Ring',
    category: 'Rings',
    metalType: 'Silver (999)',
    defaultWastagePercent: 2.0,
    defaultMakingChargeType: 'flat',
    defaultMakingChargeValue: 600,
    defaultStoneType: 'None',
    hsnCode: '7113',
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'design-7',
    designCode: 'CHN-22K-033',
    name: 'Classic 4-Sided Laser Cut Rope Chain',
    category: 'Chains',
    metalType: 'Gold (22K)',
    defaultWastagePercent: 2.5,
    defaultMakingChargeType: 'per-gram',
    defaultMakingChargeValue: 350,
    defaultStoneType: 'None',
    hsnCode: '7113',
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'design-8',
    designCode: 'COI-24K-001',
    name: 'Goddess Lakshmi Gold Coin 10g',
    category: 'Coins',
    metalType: 'Gold (24K)',
    defaultWastagePercent: 0,
    defaultMakingChargeType: 'flat',
    defaultMakingChargeValue: 450,
    defaultStoneType: 'None',
    // Bullion, not an article of jewellery. Same 3% rate as 7113, but GSTR-1's
    // HSN-wise summary would be wrong if coins were filed as ornaments (Milestone 21).
    hsnCode: '7108',
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1610375461369-d613b564f4c4?w=400&auto=format&fit=crop&q=60'
  }
];

// Atomic, individually-weighed physical pieces (PRD §5.1-5.2, Handbook Phase 3). IDs are kept
// identical to the pre-split `item-N` ids so existing mock SaleInvoice.items[].itemId
// references above still resolve correctly.
export const initialTags: Tag[] = [
  {
    id: 'item-1',
    branchId: 'br-1',
    sku: 'RNG-22K-001',
    itemDesignId: 'design-1',
    name: 'Antique Peacock Royal Ring',
    category: 'Rings',
    metalType: 'Gold (22K)',
    grossWeight: 8.45,
    netWeight: 8.20,
    wastagePercent: 3.5,
    makingChargeType: 'per-gram',
    makingChargeValue: 450,
    stoneType: 'Ruby',
    stoneWeight: 0.85,
    stoneCharge: 4500,
    certificateNo: 'GIA-8736481',
    huid: 'A1B2C3',
    stockOwnershipType: 'OWNED',
    status: 'InShowcase',
    imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'item-2',
    branchId: 'br-1',
    sku: 'NEC-22K-042',
    itemDesignId: 'design-2',
    name: 'Temple Heritage Kundan Choker',
    category: 'Necklaces',
    metalType: 'Gold (22K)',
    grossWeight: 45.30,
    netWeight: 41.20,
    wastagePercent: 5.0,
    makingChargeType: 'per-gram',
    makingChargeValue: 650,
    stoneType: 'Cubic Zirconia',
    stoneWeight: 4.5,
    stoneCharge: 12500,
    certificateNo: 'BIS-9983173',
    huid: 'D4E5F6',
    stockOwnershipType: 'OWNED',
    status: 'InStock',
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'item-3',
    branchId: 'br-1',
    sku: 'EAR-18K-109',
    itemDesignId: 'design-3',
    name: 'Solitaire Halo Diamond Studs',
    category: 'Earrings',
    metalType: 'Gold (18K)',
    grossWeight: 3.80,
    netWeight: 3.40,
    wastagePercent: 2.0,
    makingChargeType: 'flat',
    makingChargeValue: 2500,
    stoneType: 'Diamond',
    stoneWeight: 1.20,
    stoneCharge: 85000,
    certificateNo: 'IGI-2248590',
    stockOwnershipType: 'GML_FINANCED',
    status: 'PendingHallmark',
    imageUrl: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'item-4',
    branchId: 'br-2',
    sku: 'BGL-22K-081',
    itemDesignId: 'design-4',
    name: 'Bridal Filigree Kada Bangles (Pair)',
    category: 'Bangles',
    metalType: 'Gold (22K)',
    grossWeight: 32.10,
    netWeight: 32.10,
    wastagePercent: 4.0,
    makingChargeType: 'per-gram',
    makingChargeValue: 500,
    stoneType: 'None',
    stoneWeight: 0,
    stoneCharge: 0,
    certificateNo: 'BIS-7324519',
    huid: 'G7H8J9',
    stockOwnershipType: 'OWNED',
    status: 'InStock',
    imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'item-5',
    branchId: 'br-2',
    sku: 'NEC-18K-005',
    itemDesignId: 'design-5',
    name: 'Modernist Diamond Drop Pendant',
    category: 'Necklaces',
    metalType: 'Gold (18K)',
    grossWeight: 12.80,
    netWeight: 11.90,
    wastagePercent: 3.0,
    makingChargeType: 'per-gram',
    makingChargeValue: 550,
    stoneType: 'Diamond',
    stoneWeight: 2.10,
    stoneCharge: 165000,
    certificateNo: 'IGI-7483921',
    stockOwnershipType: 'CONSIGNMENT',
    status: 'InShowcase',
    imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'item-6',
    branchId: 'br-1',
    sku: 'RNG-SLV-002',
    itemDesignId: 'design-6',
    name: 'Classic Vintage Marquise Silver Ring',
    category: 'Rings',
    metalType: 'Silver (999)',
    grossWeight: 6.50,
    netWeight: 6.10,
    wastagePercent: 2.0,
    makingChargeType: 'flat',
    makingChargeValue: 600,
    stoneType: 'None',
    stoneWeight: 0,
    stoneCharge: 0,
    certificateNo: undefined,
    stockOwnershipType: 'OWNED',
    status: 'InStock',
    imageUrl: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'item-7',
    branchId: 'br-3',
    sku: 'CHN-22K-033',
    itemDesignId: 'design-7',
    name: 'Classic 4-Sided Laser Cut Rope Chain',
    category: 'Chains',
    metalType: 'Gold (22K)',
    grossWeight: 18.50,
    netWeight: 18.50,
    wastagePercent: 2.5,
    makingChargeType: 'per-gram',
    makingChargeValue: 350,
    stoneType: 'None',
    stoneWeight: 0,
    stoneCharge: 0,
    certificateNo: 'BIS-8392104',
    huid: 'K1L2M3',
    stockOwnershipType: 'OWNED',
    status: 'OutForJobwork',
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 'item-8',
    branchId: 'br-1',
    sku: 'COI-24K-001',
    itemDesignId: 'design-8',
    name: 'Goddess Lakshmi Gold Coin 10g',
    category: 'Coins',
    metalType: 'Gold (24K)',
    grossWeight: 10.00,
    netWeight: 10.00,
    wastagePercent: 0,
    makingChargeType: 'flat',
    makingChargeValue: 450,
    stoneType: 'None',
    stoneWeight: 0,
    stoneCharge: 0,
    certificateNo: 'MMTC-110294',
    huid: 'N4P5Q6',
    stockOwnershipType: 'OWNED',
    status: 'InStock',
    imageUrl: 'https://images.unsplash.com/photo-1610375461369-d613b564f4c4?w=400&auto=format&fit=crop&q=60'
  }
];

export const initialCustomers: Customer[] = [
  {
    id: 'cust-1',
    name: 'Sharda Sharma',
    phone: '9876543210',
    email: 'sharda.sharma@example.com',
    tier: 'Platinum',
    loyaltyPoints: 3450,
    lifetimeSpend: 425000,
    savingsSchemeActive: true,
    savingsSchemeMaturityDate: '2026-11-15',
    savingsSchemeBalance: 50000,
    stateCode: '27'
  },
  {
    id: 'cust-2',
    name: 'Ananya Deshmukh',
    phone: '9812345678',
    email: 'ananya.d@example.com',
    tier: 'Gold',
    loyaltyPoints: 1200,
    lifetimeSpend: 185000,
    savingsSchemeActive: false,
    // Karnataka buyer — an inter-state sale from either Maharashtra branch, so IGST.
    stateCode: '29'
  },
  {
    id: 'cust-3',
    name: 'Rajesh Mehta',
    phone: '9922334455',
    email: 'rajeshmehta@example.com',
    tier: 'Silver',
    loyaltyPoints: 450,
    lifetimeSpend: 75000,
    savingsSchemeActive: true,
    savingsSchemeMaturityDate: '2026-08-20',
    savingsSchemeBalance: 11000
  },
  {
    id: 'cust-4',
    name: 'Vikram Singh',
    phone: '9765432109',
    email: 'vikram.singh@example.com',
    tier: 'Bronze',
    loyaltyPoints: 80,
    lifetimeSpend: 14500,
    savingsSchemeActive: false,
    stateCode: '27'
  },
  {
    id: 'cust-5',
    name: 'Priyanka Sen',
    phone: '9554433221',
    email: 'priyanka.sen@example.com',
    tier: 'Platinum',
    loyaltyPoints: 4800,
    lifetimeSpend: 620000,
    savingsSchemeActive: true,
    savingsSchemeMaturityDate: '2027-02-10',
    savingsSchemeBalance: 80000,
    // Registered B2B buyer: Rule 46 requires the customer GSTIN on the invoice.
    stateCode: '29',
    gstin: '29AABCU9603R1ZM'
  }
];

export const initialKarigars: Karigar[] = [
  {
    id: 'kar-1',
    name: 'Ramesh Lohar (Bengal Artisan)',
    phone: '9421839210',
    specialty: 'Filigree Work & Antique Chokers',
    metalBalance: 42.15, // grams of 22K gold currently in hand
    laborChargesOwed: 14500,
    rating: 4.8
  },
  {
    id: 'kar-2',
    name: 'Hariprasad Soni',
    phone: '9321873211',
    specialty: 'Stone Setting & Diamond Halos',
    metalBalance: 12.80,
    laborChargesOwed: 8200,
    rating: 4.9
  },
  {
    id: 'kar-3',
    name: 'Mohammad Ali (Zardozi Art)',
    phone: '9845392010',
    specialty: 'Kundan & Temple Jewellery fusion',
    metalBalance: 65.40,
    laborChargesOwed: 22000,
    rating: 4.7
  },
  {
    id: 'kar-4',
    name: 'Gopal Patwardhan',
    phone: '9123456789',
    specialty: 'Bangles & Plain Solid Gold Chains',
    metalBalance: -5.20, // Negative balance means artisan gave more gold back than received, or we gave them gold in advance credit
    laborChargesOwed: 3500,
    rating: 4.5
  }
];

// Unified Karigar Job-Work (Milestone 17). This replaces `initialWorkOrders` and
// `initialJobBags`, which described the SAME jobs twice with no shared identity:
//   wo-1 "Mayur Peacock Gold Jhumkas" and bag-1 were one job (same karigar, 15g, same due date)
//   wo-3 "Imperial Nizam Jadau Choker" and bag-2 were likewise one job
// Three work orders plus four job bags therefore merge into five real jobs.
export const initialJobWorks: JobWork[] = [
  {
    id: 'job-1',
    jobNo: 'JOB-2026-001',
    karigarId: 'kar-1',
    karigarName: 'Ramesh Lohar (Bengal Artisan)',
    clientName: 'Sharda Sharma',
    designName: 'Mayur Peacock Gold Jhumkas',
    category: 'Earrings',
    metalType: 'Gold (22K)',
    goldIssued: 15.00,
    issueDate: '2026-07-15',
    dueDate: '2026-07-25',
    stage: 'Filing',
    priority: 'Urgent',
    stonesIssued: '2 Rubies (0.40ct total)',
    metalLossRecorded: 0.05,
    receiptStatus: 'Pending',
    notes: 'Incorporate delicate red enamel detailing on the eyes. Keep filigree extra sharp per client.',
    createdAt: '2026-07-15'
  },
  {
    id: 'job-2',
    jobNo: 'JOB-2026-002',
    karigarId: 'kar-2',
    karigarName: 'Hariprasad Soni',
    designName: 'Infinity Diamond Tennis Bracelet',
    category: 'Bracelets',
    metalType: 'Gold (18K)',
    goldIssued: 18.50,
    issueDate: '2026-07-10',
    dueDate: '2026-07-20',
    stage: 'Completed',
    priority: 'Normal',
    stonesIssued: '24 Solitaire stones',
    metalLossRecorded: 0.20,
    receiptStatus: 'Received',
    finishedWeight: 18.25,
    finishedMetalType: 'Gold (18K)',
    actualWastage: 0.20,
    laborCharge: 9500,
    notes: 'Excellent prongs setting for the 24 solitaire stones',
    createdAt: '2026-07-10'
  },
  {
    id: 'job-3',
    jobNo: 'JOB-2026-003',
    karigarId: 'kar-3',
    karigarName: 'Mohammad Ali (Zardozi Art)',
    clientName: 'Priyanka Sen',
    designName: 'Imperial Nizam Jadau Choker',
    category: 'Necklaces',
    metalType: 'Gold (22K)',
    goldIssued: 55.00,
    issueDate: '2026-07-18',
    dueDate: '2026-08-05',
    stage: 'Casting',
    priority: 'Normal',
    stonesIssued: '6 Zambian Emeralds, 12 Kundan plates',
    metalLossRecorded: 0.12,
    receiptStatus: 'Pending',
    notes: 'Client requested green emerald drop bead hooks',
    createdAt: '2026-07-18'
  },
  {
    id: 'job-4',
    jobNo: 'JOB-2026-004',
    karigarId: 'kar-2',
    karigarName: 'Hariprasad Soni',
    clientName: 'Rajesh Mehta',
    designName: 'Solitaire Halo Diamond Studs',
    category: 'Earrings',
    metalType: 'Gold (18K)',
    goldIssued: 3.80,
    issueDate: '2026-07-10',
    dueDate: '2026-07-20',
    stage: 'Setting',
    priority: 'Express',
    stonesIssued: '2 Solitaire Diamonds (1.20ct), 32 Halo Diamonds',
    metalLossRecorded: 0.02,
    receiptStatus: 'Pending',
    notes: 'Halo alignment must be perfectly concentric.',
    createdAt: '2026-07-10'
  },
  {
    id: 'job-5',
    jobNo: 'JOB-2026-005',
    karigarId: 'kar-4',
    karigarName: 'Gopal Patwardhan',
    clientName: 'Ananya Deshmukh',
    designName: 'Classic Vintage Marquise Silver Ring',
    category: 'Rings',
    metalType: 'Silver (999)',
    goldIssued: 6.50,
    issueDate: '2026-07-21',
    dueDate: '2026-07-28',
    stage: 'Polishing',
    priority: 'Normal',
    stonesIssued: 'None',
    metalLossRecorded: 0.08,
    receiptStatus: 'Pending',
    notes: 'High mirror polish finish requested.',
    createdAt: '2026-07-21'
  }
];

export const initialInvoices: SaleInvoice[] = [
  {
    id: 'inv-1',
    invoiceType: 'TAX_INVOICE',
    invoiceNumber: 'INV-2026-1021',
    date: '2026-07-10',
    customerId: 'cust-1',
    customerName: 'Sharda Sharma',
    customerPhone: '9876543210',
    items: [
      {
        itemId: 'item-3',
        sku: 'EAR-18K-109',
        name: 'Solitaire Halo Diamond Studs',
        metalType: 'Gold (18K)',
        netWeight: 3.40,
        wastagePercent: 2.0,
        makingChargeType: 'flat',
        makingChargeValue: 2500,
        goldPrice: 18496, // metal value only: 3.4 * 5440
        wastageValue: 370, // 3.4 * 2% * 5440, rounded
        makingCharge: 2500, // flat charge, not multiplied by weight
        stoneCharge: 85000,
        subtotal: 106366 // 18496 + 370 + 2500 + 85000
      }
    ],
    oldGoldWeight: 5.0,
    oldGoldValue: 30000, // old gold bought back at reduced purity valuation, netted at settlement only
    subtotal: 106366,
    tax: 3146, // 3% GST on the taxable value AFTER discount (106366 - 1500 = 104866), per Milestone 7 — never reduced by old gold trade-in
    discount: 1500,
    grandTotal: 108012, // (106366 - 1500) + 3146
    netAmountDue: 78012, // grandTotal - oldGoldValue
    paymentMethod: 'UPI'
  },
  {
    id: 'inv-2',
    invoiceType: 'TAX_INVOICE',
    invoiceNumber: 'INV-2026-1022',
    date: '2026-07-18',
    customerId: 'cust-2',
    customerName: 'Ananya Deshmukh',
    customerPhone: '9812345678',
    items: [
      {
        itemId: 'item-1',
        sku: 'RNG-22K-001',
        name: 'Antique Peacock Royal Ring',
        metalType: 'Gold (22K)',
        netWeight: 8.20,
        wastagePercent: 3.5,
        makingChargeType: 'per-gram',
        makingChargeValue: 450,
        goldPrice: 54530, // metal value only: 8.2 * 6650
        wastageValue: 1909, // 8.2 * 3.5% * 6650, rounded
        makingCharge: 3690, // 8.2 * 450
        stoneCharge: 4500,
        subtotal: 64629 // 54530 + 1909 + 3690 + 4500
      }
    ],
    oldGoldWeight: 0,
    oldGoldValue: 0,
    subtotal: 64629,
    tax: 1939, // 3% GST on taxable subtotal
    discount: 0,
    grandTotal: 66568, // 64629 + 1939
    netAmountDue: 66568,
    paymentMethod: 'Card'
  }
];

export const initialLooseStones: LooseStone[] = [
  {
    id: 'stone-1',
    lotNo: 'DIA-LOT-402',
    stoneType: 'Diamond',
    cut: 'Round Brilliant',
    color: 'G',
    clarity: 'VVS2',
    caratWeight: 4.85,
    quantity: 12,
    valuePerCarat: 110000,
    totalValue: 533500,
    certification: 'GIA',
    certificateNo: 'GIA-24859012',
    status: 'In Vault'
  },
  {
    id: 'stone-2',
    lotNo: 'RUB-LOT-019',
    stoneType: 'Ruby',
    cut: 'Oval',
    color: 'Pigeon Blood Red',
    clarity: 'VS1',
    caratWeight: 8.20,
    quantity: 4,
    valuePerCarat: 35000,
    totalValue: 287000,
    certification: 'IGI',
    certificateNo: 'IGI-RUB-8921',
    status: 'In Vault'
  },
  {
    id: 'stone-3',
    lotNo: 'EME-LOT-088',
    stoneType: 'Emerald',
    cut: 'Emerald',
    color: 'Deep Zambian Green',
    clarity: 'VS2',
    caratWeight: 6.40,
    quantity: 6,
    valuePerCarat: 48000,
    totalValue: 307200,
    certification: 'None',
    status: 'Issued',
    assignedKarigarName: 'Ramesh Lohar (Bengal Artisan)'
  },
  {
    id: 'stone-4',
    lotNo: 'DIA-SOL-001',
    stoneType: 'Diamond',
    cut: 'Cushion',
    color: 'E',
    clarity: 'FL-IF',
    caratWeight: 1.50,
    quantity: 1,
    valuePerCarat: 450000,
    totalValue: 675000,
    certification: 'GIA',
    certificateNo: 'GIA-11928471',
    status: 'In Vault'
  },
  {
    id: 'stone-5',
    lotNo: 'SAP-LOT-102',
    stoneType: 'Sapphire',
    cut: 'Oval',
    color: 'Royal Velvet Blue',
    clarity: 'VVS1',
    caratWeight: 5.10,
    quantity: 3,
    valuePerCarat: 75000,
    totalValue: 382500,
    certification: 'HRD',
    certificateNo: 'HRD-SAP-9321',
    status: 'In Vault'
  }
];


// Old Gold buyback vouchers (PRD §8, Milestone 14). Figures follow §8.2's formula:
// Net Payable Weight = Gross × Purity% × (1 − Loss%), rounded to 3dp, then × buy-back rate.
export const initialOldGoldVouchers: OldGoldVoucher[] = [
  {
    id: 'ogv-1',
    voucherNumber: 'OGV-2026-301',
    date: '2026-07-18',
    customerId: 'cust-2',
    customerName: 'Ananya Deshmukh',
    customerPhone: '9812345678',
    itemDescription: 'Old 22KT bangle pair, worn, one hinge broken',
    grossWeight: 18.500,
    testedPurityPercent: 91.6,
    meltingLossPercent: 3,
    netPayableWeight: 16.438, // 18.500 × 0.916 × 0.97 = 16.437800 -> 16.438
    buybackRatePerGram: 6118,
    buybackValue: 100568, // 16.438 × 6118 = 100,568.28
    settlementMode: 'ADJUSTED_AGAINST_INVOICE',
    linkedInvoiceNumber: 'INV-2026-1022',
    status: 'InSafe'
  },
  {
    id: 'ogv-2',
    voucherNumber: 'OGV-2026-302',
    date: '2026-07-22',
    customerName: 'Walk-in Seller',
    customerPhone: '9876500011',
    itemDescription: 'Assorted 18KT scrap — 2 rings, 1 broken chain',
    grossWeight: 9.200,
    testedPurityPercent: 75.0,
    meltingLossPercent: 4,
    netPayableWeight: 6.624, // 9.200 × 0.75 × 0.96 = 6.624
    buybackRatePerGram: 5010,
    buybackValue: 33186, // 6.624 × 5010
    settlementMode: 'CASH',
    status: 'InSafe'
  }
];

// Append-only Karigar ledger (PRD §6.2, Milestone 16, closes KNOWN_ISSUES #10).
// These are OPENING entries that reproduce the balances the old mutable `metalBalance` /
// `laborChargesOwed` fields carried, converted to fine (24K-equivalent) grams at 22K purity.
// From here on every movement appends a new entry — nothing is ever edited in place.
export const initialKarigarLedger: KarigarLedgerEntry[] = [
  {
    id: 'kle-open-1', karigarId: 'kar-1', date: '2026-07-01', sequence: 1,
    type: 'METAL_ISSUED', narration: 'Opening balance carried forward',
    fineWeightDelta: 38.609, grossWeight: 42.15, purityPercent: 91.6
  },
  {
    id: 'kle-open-2', karigarId: 'kar-1', date: '2026-07-01', sequence: 2,
    type: 'LABOUR_CHARGED', narration: 'Opening labour payable carried forward',
    moneyDelta: 14500
  },
  {
    id: 'kle-open-3', karigarId: 'kar-2', date: '2026-07-01', sequence: 3,
    type: 'METAL_ISSUED', narration: 'Opening balance carried forward',
    fineWeightDelta: 11.725, grossWeight: 12.80, purityPercent: 91.6
  },
  {
    id: 'kle-open-4', karigarId: 'kar-2', date: '2026-07-01', sequence: 4,
    type: 'LABOUR_CHARGED', narration: 'Opening labour payable carried forward',
    moneyDelta: 8200
  },
  {
    id: 'kle-open-5', karigarId: 'kar-3', date: '2026-07-01', sequence: 5,
    type: 'METAL_ISSUED', narration: 'Opening balance carried forward',
    fineWeightDelta: 59.906, grossWeight: 65.40, purityPercent: 91.6
  },
  {
    id: 'kle-open-6', karigarId: 'kar-3', date: '2026-07-01', sequence: 6,
    type: 'LABOUR_CHARGED', narration: 'Opening labour payable carried forward',
    moneyDelta: 22000
  },
  {
    // Negative opening: this artisan returned more metal than was issued (advance credit)
    id: 'kle-open-7', karigarId: 'kar-4', date: '2026-07-01', sequence: 7,
    type: 'METAL_RETURNED', narration: 'Opening credit balance carried forward',
    fineWeightDelta: -4.763, grossWeight: 5.20, purityPercent: 91.6
  },
  {
    id: 'kle-open-8', karigarId: 'kar-4', date: '2026-07-01', sequence: 8,
    type: 'LABOUR_CHARGED', narration: 'Opening labour payable carried forward',
    moneyDelta: 3500
  }
];

// Branch Master (PRD §2/§4.8, Milestone 19). Two branches in the same state plus one in
// another, so the Milestone 21 CGST/SGST-vs-IGST split has something real to work against.
// Each carries its OWN invoice series prefix — GST Rule 46 requires the tax-invoice series
// to be consecutive per GSTIN, and each branch has a distinct GSTIN.
export const initialBranches: Branch[] = [
  {
    id: 'br-1',
    branchCode: 'MUM-01',
    name: 'Mumbai BST Showroom',
    address: '102, Gold Palace Plaza, Zaveri Bazaar, Mumbai, MH - 400002',
    gstin: '27AACCS9948H1Z1',
    stateCode: '27',
    invoiceSeriesPrefix: 'MUM',
    defaultStockOwnershipType: 'OWNED',
    isActive: true
  },
  {
    id: 'br-2',
    branchCode: 'PUN-02',
    name: 'Pune Camp Boutique',
    address: '44, MG Road, Camp, Pune, MH - 411001',
    gstin: '27AACCS9948H2Z9',
    stateCode: '27',
    invoiceSeriesPrefix: 'PUN',
    defaultStockOwnershipType: 'OWNED',
    isActive: true,
    // Branch-level override (D-1): Pune quotes 22K slightly above the HQ rate.
    rateOverrides: { 'Gold (22K)': 6690 }
  },
  {
    id: 'br-3',
    branchCode: 'BLR-03',
    name: 'Bengaluru Jayanagar',
    address: '18, 11th Main, Jayanagar 4th Block, Bengaluru, KA - 560011',
    gstin: '29AACCS9948H3Z7',
    stateCode: '29',
    invoiceSeriesPrefix: 'BLR',
    defaultStockOwnershipType: 'OWNED',
    isActive: true
  }
];

/**
 * Tax Master (PRD §9.2, Milestone 21). Rates are DATA, never constants — §9.2 requires
 * the accountant be able to apply a GST Council notification immediately, with
 * effective-date versioning so an old invoice still resolves the rate it was billed at.
 *
 * Note 7102 (diamond) is seeded at 1.5% because that is what §9.2 lists, but nothing is
 * *assigned* to it: `defaultHsnForLine()` bills a diamond-set ornament as one composite
 * supply under 7113 until the HANDOFF.md item 1 question gets CA sign-off. The row exists
 * so that the switch, when authorised, is a data change rather than an engine change.
 */
export const initialTaxRates: TaxRate[] = [
  {
    id: 'tax-7113',
    hsnCode: '7113',
    description: 'Articles of jewellery — gold, silver, platinum',
    gstRatePercent: 3,
    effectiveFrom: '2017-07-01',
    notificationRef: 'Notf. 1/2017-CTR Sch. V'
  },
  {
    id: 'tax-7102',
    hsnCode: '7102',
    description: 'Diamonds — unset, cut & polished',
    gstRatePercent: 1.5,
    effectiveFrom: '2022-07-18',
    notificationRef: 'Notf. 6/2022-CTR'
  },
  {
    id: 'tax-7103',
    hsnCode: '7103',
    description: 'Precious & semi-precious stones (other than diamond)',
    gstRatePercent: 3,
    effectiveFrom: '2017-07-01',
    notificationRef: 'Notf. 1/2017-CTR Sch. V'
  },
  {
    id: 'tax-7108',
    hsnCode: '7108',
    description: 'Gold bullion — bars & coins',
    gstRatePercent: 3,
    effectiveFrom: '2017-07-01',
    notificationRef: 'Notf. 1/2017-CTR Sch. V'
  },
  {
    id: 'tax-7106',
    hsnCode: '7106',
    description: 'Silver bullion — bars & coins',
    gstRatePercent: 3,
    effectiveFrom: '2017-07-01',
    notificationRef: 'Notf. 1/2017-CTR Sch. V'
  },
  {
    id: 'tax-9988',
    hsnCode: '9988',
    description: 'Job-work service on gems & jewellery (SAC)',
    gstRatePercent: 5,
    effectiveFrom: '2017-07-01',
    isService: true,
    notificationRef: 'Notf. 11/2017-CTR'
  }
];

/**
 * Gold Savings Scheme master (PRD §12, Milestone 26). Two deliberately different schemes so the
 * engine is exercised on both bonus types — the old hardcoded behaviour was a single 11+1.
 */
export const initialSavingsSchemes: SavingsScheme[] = [
  {
    id: 'sch-1',
    schemeCode: 'SN11',
    name: 'Swarna Nidhi 11 + 1',
    tenureMonths: 11,
    bonusType: 'EXTRA_INSTALMENT',
    bonusValue: 1,
    installmentAmount: 5000,
    isFixedInstallment: true,
    redemptionRule: 'JEWELLERY_ONLY',
    prematureClosurePenaltyPercent: 10,
    isActive: true
  },
  {
    id: 'sch-2',
    schemeCode: 'DHAN18',
    name: 'Dhanvarsha Flexi 18',
    tenureMonths: 18,
    bonusType: 'PERCENTAGE',
    bonusValue: 8,
    installmentAmount: 2500, // minimum, not fixed
    isFixedInstallment: false,
    redemptionRule: 'JEWELLERY_ONLY',
    prematureClosurePenaltyPercent: 5,
    isActive: true
  }
];

// Enrollments carry no balance of their own — it is folded from the receipts below (M16 pattern).
export const initialSchemeEnrollments: SchemeEnrollment[] = [
  {
    id: 'en-1',
    enrollmentNo: 'SCH-2026-001',
    customerId: 'cust-1',
    schemeId: 'sch-1',
    startDate: '2026-01-15',
    installmentAmount: 5000,
    status: 'Active',
    branchId: 'br-1'
  },
  {
    id: 'en-2',
    enrollmentNo: 'SCH-2026-002',
    customerId: 'cust-3',
    schemeId: 'sch-2',
    startDate: '2026-03-20',
    installmentAmount: 3000,
    status: 'Active',
    branchId: 'br-1'
  },
  {
    // Deliberately behind on payments, so the collection-overdue report has something real in it.
    id: 'en-3',
    enrollmentNo: 'SCH-2026-003',
    customerId: 'cust-5',
    schemeId: 'sch-1',
    startDate: '2026-02-10',
    installmentAmount: 5000,
    status: 'Active',
    branchId: 'br-1'
  }
];

export const initialSchemeInstalments: SchemeInstalment[] = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `si-1-${i + 1}`,
    enrollmentId: 'en-1',
    installmentNo: i + 1,
    amount: 5000,
    paidOn: `2026-0${i + 1}-15`,
    mode: (i % 2 === 0 ? 'Cash' : 'UPI') as 'Cash' | 'UPI',
    receiptNo: `SR-2026-000${i + 1}`
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `si-2-${i + 1}`,
    enrollmentId: 'en-2',
    installmentNo: i + 1,
    amount: 3000,
    paidOn: `2026-0${i + 3}-20`,
    mode: 'UPI' as const,
    receiptNo: `SR-2026-001${i + 1}`
  })),
  // Only two of the expected instalments — this enrollment is the overdue case.
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `si-3-${i + 1}`,
    enrollmentId: 'en-3',
    installmentNo: i + 1,
    amount: 5000,
    paidOn: `2026-0${i + 2}-10`,
    mode: 'Cash' as const,
    receiptNo: `SR-2026-002${i + 1}`
  }))
];

/**
 * Supplier Master (PRD §4.4, Milestone 37). Tenant-wide — no `branchId`, per decision D-5.
 * Deliberately mixed: two registered dealers in different states so the intra/inter-state tax
 * split has something to exercise, and one unregistered service provider so reverse-charge
 * exposure (PRD §9.7, Milestone 40) is visible from day one.
 */
export const initialSuppliers: Supplier[] = [
  {
    id: 'sup-1',
    supplierCode: 'SUP-0001',
    name: 'Zaveri Bullion & Refinery Co.',
    supplierType: 'BULLION_DEALER',
    phone: '9820011223',
    email: 'trade@zaveribullion.in',
    address: '14, Sheikh Memon Street, Zaveri Bazaar, Mumbai, MH - 400002',
    gstin: '27AACCS9948H1Z1',
    pan: 'AACCS9948H',
    stateCode: '27',
    openingBalance: 485000, // shop owes them
    creditTermsDays: 30,
    isActive: true
  },
  {
    id: 'sup-2',
    supplierCode: 'SUP-0002',
    name: 'Rajwada Jewels Wholesale',
    supplierType: 'WHOLESALER',
    phone: '9845067890',
    email: 'orders@rajwadajewels.com',
    address: '221, Chickpet Main Road, Bengaluru, KA - 560053',
    // Karnataka (29) — an inter-state purchase, so this attracts IGST rather than CGST+SGST.
    gstin: '29AADCR2233K1ZP',
    pan: 'AADCR2233K',
    stateCode: '29',
    openingBalance: 0,
    creditTermsDays: 45,
    isActive: true
  },
  {
    id: 'sup-3',
    supplierCode: 'SUP-0003',
    name: 'Suresh Polishing Works',
    supplierType: 'SERVICE',
    phone: '9769123456',
    address: 'Shop 4, Kalbadevi, Mumbai, MH - 400002',
    // Unregistered on purpose: a notified service from an unregistered supplier is where
    // Reverse Charge bites (PRD §9.7). Milestone 40 books it.
    stateCode: '27',
    openingBalance: -12000, // an advance sits with them
    creditTermsDays: 0,
    isActive: true
  }
];

/**
 * Purchase Orders (PRD §6.1, Milestone 38). One fixed-rate order and one deliberately UNFIXED,
 * so the "committed weight but no knowable value" case is exercised from the first render.
 */
export const initialPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-1',
    poNumber: 'PO-2026-27-001',
    supplierId: 'sup-1',
    orderDate: '2026-07-05',
    expectedDeliveryDate: '2026-07-20',
    rateBasis: 'FIXED',
    status: 'Sent',
    branchId: 'br-1',
    lines: [
      {
        id: 'pol-1', kind: 'RAW_METAL', description: '100g 24K bullion bar',
        metalType: 'Gold (24K)', purityPercent: 99.9, orderedWeight: 100, ratePerGram: 7250
      }
    ]
  },
  {
    // Rate to be fixed at delivery — the common bullion arrangement. Carries 250g of metal
    // commitment and no rupee value at all until the rate is settled.
    id: 'po-2',
    poNumber: 'PO-2026-27-002',
    supplierId: 'sup-1',
    orderDate: '2026-07-12',
    expectedDeliveryDate: '2026-08-01',
    rateBasis: 'UNFIXED',
    status: 'Sent',
    branchId: 'br-1',
    lines: [
      {
        id: 'pol-2', kind: 'RAW_METAL', description: '250g 22K casting grain',
        metalType: 'Gold (22K)', purityPercent: 91.6, orderedWeight: 250
      }
    ]
  },
  {
    id: 'po-3',
    poNumber: 'PO-2026-27-003',
    supplierId: 'sup-2',
    orderDate: '2026-07-18',
    expectedDeliveryDate: '2026-08-10',
    rateBasis: 'FIXED',
    status: 'Sent',
    branchId: 'br-1',
    lines: [
      {
        id: 'pol-3', kind: 'FINISHED_GOODS', description: 'Temple Heritage Kundan Choker',
        itemDesignId: 'design-2', orderedQty: 3, ratePerPiece: 265000
      }
    ]
  }
];
