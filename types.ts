
export enum SalesCategory {
  TARGET = 'Target (TG)',
  BETA = 'Beta',
  OTHER = 'Other',
  TOTAL = 'Total (All Categories)' // New Category for Total Volume
}

export interface PersonSalesRow {
  customerName: string;
  subgroup: string; // The Sales Rep or Beta Subgroup Name
  netSales: number;
  returns: number;
  isBeta: boolean;
}

export interface GoodsSalesRow {
  buyerName: string;
  productCode: string;
  netSales: number;
  returns: number;
}

export interface ExpenseRow {
  executorName: string;
  linkedRep?: string;
  amount: number;
  description: string;
  assignedCategory?: SalesCategory;
}

// --- New Commission Logic Types ---

export interface CommissionTier {
  min: number;
  max: number;
  value: number; // Changed from 'percentage' to 'value' to support fixed amounts
  type: 'percent' | 'fixed'; // New field to distinguish calculation type
}

export interface CategoryRule {
  category: SalesCategory;
  tiers: CommissionTier[];
}

export interface CommissionProfile {
  id: string;
  name: string; // e.g. "کارشناس فروش تهران", "مدیر فروش"
  rules: CategoryRule[]; // Rules for Target, Beta, Other, Total
}

export interface Manager {
  id: string;
  name: string;
  subordinates: string[]; // List of Rep Names (subgroups) from Excel
  profileId: string; // Linked Commission Profile
}

export interface RepSettings {
  name: string; // Rep Name
  profileId: string; // Linked Commission Profile
}

export interface BetaMapping {
  betaSubgroup: string; // The name in Excel (e.g., "گروه بتا (امیر رضا)")
  assignedRepName: string; // The real Sales Rep (e.g., "علی علوی")
}

// --- Updated Result Types ---

export interface AggregatedSalesData {
  repName: string;
  targetSales: number;
  betaSales: number;
  otherSales: number;
  targetDeductions: number;
  betaDeductions: number;
  otherDeductions: number;
  totalNet: number;
  
  // Calculated Commission Fields
  commissionTarget?: number;
  commissionBeta?: number;
  commissionOther?: number;
  commissionTotal?: number; // New field for bonus on total volume
  totalCommission?: number;
}

export interface ManagerSubordinateDetail {
  repName: string;
  targetNet: number;
  betaNet: number;
  otherNet: number;
  totalNet: number;
}

export interface ManagerSalesData {
  managerName: string;
  teamTotalTarget: number;
  teamTotalBeta: number;
  teamTotalOther: number;
  teamTotalDeductions: number;
  commission: number;
  // NEW: Detailed breakdown of the team
  subordinatesDetails: ManagerSubordinateDetail[];
}

export interface ManualDeduction {
  id: string;
  repName: string;
  amount: number;
  category: SalesCategory;
  description: string;
}

export interface SavedReportMetadata {
  id: number;
  year: number;
  month: number;
  created_at: string;
}

export interface FullReportSnapshot {
  personSales: PersonSalesRow[];
  goodsSales: GoodsSalesRow[];
  expenses: ExpenseRow[];
  manualDeductions: ManualDeduction[];
  betaMappings: BetaMapping[];
  // We save config snapshot too to ensure historical accuracy even if rules change later
  profiles: CommissionProfile[];
  managers: Manager[];
  repSettings: RepSettings[];
}

export interface AppState {
  // Navigation State
  currentView: 'process' | 'settings' | 'history'; 
  processStep: number; // 1: Upload, 2: Beta Mapping, 3: Deductions, 4: Dashboard

  // Data State
  personSales: PersonSalesRow[];
  goodsSales: GoodsSalesRow[];
  expenses: ExpenseRow[];
  manualDeductions: ManualDeduction[];
  
  // Settings State
  commissionProfiles: CommissionProfile[];
  managers: Manager[];
  repSettings: RepSettings[];
  betaMappings: BetaMapping[]; // New mapping state
  
  // History State
  savedReports: SavedReportMetadata[];
}
