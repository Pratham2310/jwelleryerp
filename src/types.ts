export interface JewelleryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Rings' | 'Necklaces' | 'Earrings' | 'Bangles' | 'Bracelets' | 'Chains' | 'Coins';
  metalType: 'Gold (24K)' | 'Gold (22K)' | 'Gold (18K)' | 'Silver (999)' | 'Platinum (950)';
  grossWeight: number; // in grams
  netWeight: number; // in grams
  wastagePercent: number; // in %
  makingChargeType: 'per-gram' | 'flat';
  makingChargeValue: number; // currency amount
  stoneType: 'None' | 'Diamond' | 'Ruby' | 'Emerald' | 'Sapphire' | 'Cubic Zirconia';
  stoneWeight: number; // in carats
  stoneCharge: number; // currency amount
  certificateNo?: string;
  status: 'In Stock' | 'In Showcase' | 'Sold' | 'Out for Jobwork';
  imageUrl?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  loyaltyPoints: number;
  lifetimeSpend: number;
  savingsSchemeActive: boolean;
  savingsSchemeMaturityDate?: string;
  savingsSchemeBalance?: number;
}

export interface Karigar {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  metalBalance: number; // outstanding pure gold balance issued to them (in grams)
  laborChargesOwed: number; // money owed to them
  rating: number;
}

export interface WorkOrder {
  id: string;
  orderNo: string;
  karigarId: string;
  karigarName: string;
  designName: string;
  category: string;
  goldIssued: number; // in grams
  metalType: string;
  issueDate: string;
  dueDate: string;
  status: 'Assigned' | 'In Progress' | 'Completed' | 'Returned';
  finishedWeight?: number;
  actualWastage?: number;
  laborCharge?: number;
  notes?: string;
}

export interface InvoiceItem {
  itemId?: string;
  sku?: string;
  name: string;
  metalType: string;
  netWeight: number;
  goldPrice: number;
  makingCharge: number;
  stoneCharge: number;
  subtotal: number;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  items: InvoiceItem[];
  oldGoldWeight: number; // trade-in weight
  oldGoldValue: number; // trade-in value deducted
  subtotal: number;
  tax: number; // e.g. 3% GST
  discount: number;
  grandTotal: number;
  paymentMethod: 'Cash' | 'Card' | 'UPI' | 'Scheme Redemption' | 'Mixed';
}

export interface MetalRate {
  id: string;
  metalType: string;
  purity: string;
  ratePerGram: number;
  change24h: number; // percentage
  history24h: number[]; // 8 data points for sparkline
}

export interface LooseStone {
  id: string;
  lotNo: string;
  stoneType: 'Diamond' | 'Ruby' | 'Emerald' | 'Sapphire' | 'Pearl' | 'Opal';
  cut: 'Round Brilliant' | 'Oval' | 'Marquise' | 'Emerald' | 'Pear' | 'Princess' | 'Cushion';
  color: string;
  clarity: string;
  caratWeight: number;
  quantity: number;
  valuePerCarat: number;
  totalValue: number;
  certification: 'GIA' | 'IGI' | 'HRD' | 'SGL' | 'None';
  certificateNo?: string;
  status: 'In Vault' | 'Issued' | 'Sold';
  assignedKarigarName?: string;
}

export interface JobBag {
  id: string;
  bagNo: string;
  clientName: string;
  designName: string;
  currentStage: 'Casting' | 'Filing' | 'Setting' | 'Polishing' | 'Hallmark' | 'Completed';
  priority: 'Normal' | 'Urgent' | 'Express';
  metalType: string;
  metalIssuedWeight: number;
  stonesIssued: string;
  assignedKarigarName: string;
  dueDate: string;
  notes?: string;
  metalLossRecorded: number; // in grams
  createdAt: string;
}
