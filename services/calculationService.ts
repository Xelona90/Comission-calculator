
import { 
  PersonSalesRow, 
  GoodsSalesRow, 
  ExpenseRow, 
  AggregatedSalesData, 
  SalesCategory,
  ManualDeduction,
  CommissionProfile,
  RepSettings,
  Manager,
  ManagerSalesData,
  BetaMapping
} from '../types';

export const linkExpensesToReps = (expenses: ExpenseRow[], personSales: PersonSalesRow[]): ExpenseRow[] => {
  const customerRepMap = new Map<string, string>();
  personSales.forEach(p => {
    if (p.customerName && p.subgroup) {
      customerRepMap.set(p.customerName.trim(), p.subgroup);
    }
  });

  return expenses.reduce<ExpenseRow[]>((acc, exp) => {
    const foundRep = customerRepMap.get(exp.executorName.trim());
    if (foundRep) {
      acc.push({ ...exp, linkedRep: foundRep });
    }
    return acc;
  }, []);
};

// Helper: Calculate amount based on value and type (percent vs fixed)
const calculateAmount = (amount: number, tiers: any[]): number => {
  if (amount <= 0 || !tiers) return 0;
  
  // Logic: Find the tier where amount fits between min and max
  const tier = tiers.find(t => amount >= t.min && amount <= t.max);
  
  if (!tier) return 0;

  if (tier.type === 'fixed') {
    return tier.value;
  } else {
    // Default to percentage if type is missing or 'percent'
    return amount * (tier.value / 100);
  }
};

// Helper to extract the real beta rep name from the string like "Name (مشتری TargetName)"
export const extractBetaRepName = (rawSubgroup: string): string => {
  if (!rawSubgroup) return '';
  const normalized = rawSubgroup.trim();
  // Regex to match (مشتری Name) or (مشتری: Name)
  // Captures the text after "مشتری" inside parentheses
  const match = normalized.match(/\(\s*مشتری\s*[:]?\s*(.+?)\s*\)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return normalized;
};

const resolveRepName = (rawSubgroup: string, isBeta: boolean, betaMappings: BetaMapping[]): string => {
    if (!isBeta) return rawSubgroup;
    
    // 1. Extract the meaningful name (e.g., "امیررضا آجرلو" from "(مشتری امیررضا آجرلو)")
    const extracted = extractBetaRepName(rawSubgroup);
    
    // 2. Check if this extracted name is mapped
    const mapping = betaMappings.find(m => m.betaSubgroup === extracted);
    if (mapping) return mapping.assignedRepName;

    // 3. Fallback: Check if the raw string was mapped (legacy support)
    const exactMapping = betaMappings.find(m => m.betaSubgroup === rawSubgroup);
    
    // 4. If no mapping, return the extracted name (so it groups correctly in UI even if unmapped)
    return exactMapping ? exactMapping.assignedRepName : extracted;
};

export const aggregateData = (
  personSales: PersonSalesRow[],
  goodsSales: GoodsSalesRow[],
  expenses: ExpenseRow[],
  manualDeductions: ManualDeduction[],
  profiles: CommissionProfile[],
  repSettings: RepSettings[],
  betaMappings: BetaMapping[] = [] // New Param
): AggregatedSalesData[] => {
  
  const customerMap = new Map<string, { rep: string, isBeta: boolean }>();
  const reps = new Set<string>();

  // 1. Process Person Sales & Build Map
  personSales.forEach(p => {
    if (p.customerName) {
      const effectiveRep = resolveRepName(p.subgroup, p.isBeta, betaMappings);
      customerMap.set(p.customerName.trim(), { rep: effectiveRep, isBeta: p.isBeta });
      if(effectiveRep) reps.add(effectiveRep);
    }
  });

  const repData = new Map<string, AggregatedSalesData>();
  reps.forEach(rep => {
    repData.set(rep, {
      repName: rep,
      targetSales: 0,
      betaSales: 0,
      otherSales: 0,
      targetDeductions: 0,
      betaDeductions: 0,
      otherDeductions: 0,
      totalNet: 0,
      commissionTarget: 0,
      commissionBeta: 0,
      commissionOther: 0,
      totalCommission: 0
    });
  });

  // 2. Goods Processing (Using the map which now includes beta resolutions)
  goodsSales.forEach(good => {
    const customerInfo = customerMap.get(good.buyerName.trim());
    if (customerInfo) {
      const repStats = repData.get(customerInfo.rep);
      if (repStats) {
        const netAmount = good.netSales || 0; 
        if (good.productCode && good.productCode.toUpperCase().startsWith('TG')) {
          repStats.targetSales += netAmount;
        } else if (customerInfo.isBeta) {
          repStats.betaSales += netAmount;
        } else {
          repStats.otherSales += netAmount;
        }
      }
    }
  });

  // 3. Expenses Processing
  expenses.forEach(exp => {
    if (exp.linkedRep && exp.assignedCategory) {
      // exp.linkedRep is the raw subgroup name from Excel.
      // We need to resolve it to the Final Rep Name (mapped or extracted)
      const extracted = extractBetaRepName(exp.linkedRep);
      
      const mapping = betaMappings.find(m => m.betaSubgroup === extracted);
      // Fallback to exact match
      const exactMapping = betaMappings.find(m => m.betaSubgroup === exp.linkedRep);
      
      const finalRepName = mapping 
          ? mapping.assignedRepName 
          : (exactMapping ? exactMapping.assignedRepName : extracted);

      const repStats = repData.get(finalRepName);
      if (repStats) {
        const amt = exp.amount || 0;
        if (exp.assignedCategory === SalesCategory.TARGET) repStats.targetDeductions += amt;
        if (exp.assignedCategory === SalesCategory.BETA) repStats.betaDeductions += amt;
        if (exp.assignedCategory === SalesCategory.OTHER) repStats.otherDeductions += amt;
      }
    }
  });

  // 4. Manual Deductions
  manualDeductions.forEach(ded => {
    const repStats = repData.get(ded.repName);
    if (repStats) {
       const amt = ded.amount || 0;
       if (ded.category === SalesCategory.TARGET) repStats.targetDeductions += amt;
       if (ded.category === SalesCategory.BETA) repStats.betaDeductions += amt;
       if (ded.category === SalesCategory.OTHER) repStats.otherDeductions += amt;
    }
  });

  // 5. Final Calculations (Net & Commission)
  return Array.from(repData.values()).map(r => {
    const netTarget = r.targetSales - r.targetDeductions;
    const netBeta = r.betaSales - r.betaDeductions;
    const netOther = r.otherSales - r.otherDeductions;
    
    const total = netTarget + netBeta + netOther;
    r.totalNet = Number.isFinite(total) ? total : 0;

    // Find Profile
    const setting = repSettings.find(s => s.name === r.repName);
    const profile = setting ? profiles.find(p => p.id === setting.profileId) : null;

    if (profile) {
        const targetRule = profile.rules.find(rule => rule.category === SalesCategory.TARGET);
        const betaRule = profile.rules.find(rule => rule.category === SalesCategory.BETA);
        const otherRule = profile.rules.find(rule => rule.category === SalesCategory.OTHER);

        r.commissionTarget = calculateAmount(netTarget, targetRule?.tiers || []);
        r.commissionBeta = calculateAmount(netBeta, betaRule?.tiers || []);
        r.commissionOther = calculateAmount(netOther, otherRule?.tiers || []);
        r.totalCommission = (r.commissionTarget || 0) + (r.commissionBeta || 0) + (r.commissionOther || 0);
    }

    return r;
  });
};

export const calculateManagerCommissions = (
    repsData: AggregatedSalesData[],
    managers: Manager[],
    profiles: CommissionProfile[]
): ManagerSalesData[] => {
    return managers.map(mgr => {
        let teamTarget = 0;
        let teamBeta = 0;
        let teamOther = 0;
        let teamDeductions = 0;

        // Sum up subordinates
        mgr.subordinates.forEach(repName => {
            const repData = repsData.find(r => r.repName === repName);
            if (repData) {
                teamTarget += (repData.targetSales - repData.targetDeductions);
                teamBeta += (repData.betaSales - repData.betaDeductions);
                teamOther += (repData.otherSales - repData.otherDeductions);
                teamDeductions += (repData.targetDeductions + repData.betaDeductions + repData.otherDeductions);
            }
        });

        // Calculate Commission based on Manager's Profile
        const profile = profiles.find(p => p.id === mgr.profileId);
        let totalComm = 0;

        if (profile) {
            const targetRule = profile.rules.find(rule => rule.category === SalesCategory.TARGET);
            const betaRule = profile.rules.find(rule => rule.category === SalesCategory.BETA);
            const otherRule = profile.rules.find(rule => rule.category === SalesCategory.OTHER);

            totalComm += calculateAmount(teamTarget, targetRule?.tiers || []);
            totalComm += calculateAmount(teamBeta, betaRule?.tiers || []);
            totalComm += calculateAmount(teamOther, otherRule?.tiers || []);
        }

        return {
            managerName: mgr.name,
            teamTotalTarget: teamTarget,
            teamTotalBeta: teamBeta,
            teamTotalOther: teamOther,
            teamTotalDeductions: teamDeductions,
            commission: totalComm
        };
    });
};
