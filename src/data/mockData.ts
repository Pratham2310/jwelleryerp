import { ItemDesign, Tag, Customer, Karigar, WorkOrder, SaleInvoice, MetalRate, LooseStone, JobBag } from '../types';

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
    hsnCode: '7113',
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
    savingsSchemeBalance: 50000
  },
  {
    id: 'cust-2',
    name: 'Ananya Deshmukh',
    phone: '9812345678',
    email: 'ananya.d@example.com',
    tier: 'Gold',
    loyaltyPoints: 1200,
    lifetimeSpend: 185000,
    savingsSchemeActive: false
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
    savingsSchemeActive: false
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
    savingsSchemeBalance: 80000
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

export const initialWorkOrders: WorkOrder[] = [
  {
    id: 'wo-1',
    orderNo: 'WO-2026-001',
    karigarId: 'kar-1',
    karigarName: 'Ramesh Lohar (Bengal Artisan)',
    designName: 'Mayur Peacock Gold Jhumkas',
    category: 'Earrings',
    goldIssued: 15.00,
    metalType: 'Gold (22K)',
    issueDate: '2026-07-15',
    dueDate: '2026-07-25',
    status: 'In Progress',
    notes: 'Incorporate delicate red enamel detailing on the eyes'
  },
  {
    id: 'wo-2',
    orderNo: 'WO-2026-002',
    karigarId: 'kar-2',
    karigarName: 'Hariprasad Soni',
    designName: 'Infinity Diamond Tennis Bracelet',
    category: 'Bracelets',
    goldIssued: 18.50,
    metalType: 'Gold (18K)',
    issueDate: '2026-07-10',
    dueDate: '2026-07-20',
    status: 'Completed',
    finishedWeight: 18.25,
    actualWastage: 0.20,
    laborCharge: 9500,
    notes: 'Excellent prongs setting for the 24 solitaire stones'
  },
  {
    id: 'wo-3',
    orderNo: 'WO-2026-003',
    karigarId: 'kar-3',
    karigarName: 'Mohammad Ali (Zardozi Art)',
    designName: 'Imperial Nizam Jadau Choker',
    category: 'Necklaces',
    goldIssued: 55.00,
    metalType: 'Gold (22K)',
    issueDate: '2026-07-18',
    dueDate: '2026-08-05',
    status: 'Assigned',
    notes: 'Client requested green emerald emerald drop bead hooks'
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

export const initialJobBags: JobBag[] = [
  {
    id: 'bag-1',
    bagNo: 'BAG-2026-901',
    clientName: 'Sharda Sharma',
    designName: 'Mayur Peacock Gold Jhumkas',
    currentStage: 'Filing',
    priority: 'Urgent',
    metalType: 'Gold (22K)',
    metalIssuedWeight: 15.00,
    stonesIssued: '2 Rubies (0.40ct total)',
    assignedKarigarName: 'Ramesh Lohar (Bengal Artisan)',
    dueDate: '2026-07-25',
    notes: 'Please keep the filigree details extra sharp as requested by client.',
    metalLossRecorded: 0.05,
    createdAt: '2026-07-15'
  },
  {
    id: 'bag-2',
    bagNo: 'BAG-2026-902',
    clientName: 'Priyanka Sen',
    designName: 'Imperial Nizam Jadau Choker',
    currentStage: 'Casting',
    priority: 'Normal',
    metalType: 'Gold (22K)',
    metalIssuedWeight: 55.00,
    stonesIssued: '6 Zambian Emeralds, 12 Kundan plates',
    assignedKarigarName: 'Mohammad Ali (Zardozi Art)',
    dueDate: '2026-08-05',
    notes: 'Emerald drop beads should have tight wire binding.',
    metalLossRecorded: 0.12,
    createdAt: '2026-07-18'
  },
  {
    id: 'bag-3',
    bagNo: 'BAG-2026-903',
    clientName: 'Rajesh Mehta',
    designName: 'Solitaire Halo Diamond Studs',
    currentStage: 'Setting',
    priority: 'Express',
    metalType: 'Gold (18K)',
    metalIssuedWeight: 3.80,
    stonesIssued: '2 Solitaire Diamonds (1.20ct), 32 Halo Diamonds',
    assignedKarigarName: 'Hariprasad Soni',
    dueDate: '2026-07-20',
    notes: 'Perfect prong tension is critical. Avoid scratching the girdle.',
    metalLossRecorded: 0.02,
    createdAt: '2026-07-10'
  },
  {
    id: 'bag-4',
    bagNo: 'BAG-2026-904',
    clientName: 'Ananya Deshmukh',
    designName: 'Classic Vintage Marquise Silver Ring',
    currentStage: 'Polishing',
    priority: 'Normal',
    metalType: 'Silver (999)',
    metalIssuedWeight: 6.50,
    stonesIssued: 'None',
    assignedKarigarName: 'Gopal Patwardhan',
    dueDate: '2026-07-28',
    notes: 'High mirror polish finish requested.',
    metalLossRecorded: 0.08,
    createdAt: '2026-07-21'
  }
];
