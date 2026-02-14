
import * as XLSX from 'xlsx';
import { FullReportSnapshot, SalesCategory } from '../types';
import { aggregateData, calculateManagerCommissions, extractBetaRepName } from './calculationService';

export const exportReportToExcel = (snapshot: FullReportSnapshot, year: number, month: number) => {
  // 1. Recalculate everything to ensure we have the final numbers
  const aggregatedData = aggregateData(
    snapshot.personSales,
    snapshot.goodsSales,
    snapshot.expenses,
    snapshot.manualDeductions,
    snapshot.profiles,
    snapshot.repSettings,
    snapshot.betaMappings
  );

  const managersData = calculateManagerCommissions(
    aggregatedData,
    snapshot.managers,
    snapshot.profiles
  );

  // --- SHEET 1: Summary (خلاصه وضعیت کارشناسان) ---
  const summaryRows = aggregatedData.map(row => ({
    "نام کارشناس": row.repName,
    "فروش خالص تارگت": row.targetSales - row.targetDeductions,
    "پورسانت تارگت": row.commissionTarget || 0,
    "فروش خالص بتا": row.betaSales - row.betaDeductions,
    "پورسانت بتا": row.commissionBeta || 0,
    "فروش خالص سایر": row.otherSales - row.otherDeductions,
    "پورسانت سایر": row.commissionOther || 0,
    "پاداش حجم کل": row.commissionTotal || 0,
    "جمع کل پورسانت": row.totalCommission || 0,
    "جمع کل فروش": row.totalNet
  }));

  // Add Totals Row for Summary
  const totalSummary = summaryRows.reduce((acc, curr) => ({
    "نام کارشناس": "جمع کل",
    "فروش خالص تارگت": (acc["فروش خالص تارگت"] as number) + curr["فروش خالص تارگت"],
    "پورسانت تارگت": (acc["پورسانت تارگت"] as number) + curr["پورسانت تارگت"],
    "فروش خالص بتا": (acc["فروش خالص بتا"] as number) + curr["فروش خالص بتا"],
    "پورسانت بتا": (acc["پورسانت بتا"] as number) + curr["پورسانت بتا"],
    "فروش خالص سایر": (acc["فروش خالص سایر"] as number) + curr["فروش خالص سایر"],
    "پورسانت سایر": (acc["پورسانت سایر"] as number) + curr["پورسانت سایر"],
    "پاداش حجم کل": (acc["پاداش حجم کل"] as number) + curr["پاداش حجم کل"],
    "جمع کل پورسانت": (acc["جمع کل پورسانت"] as number) + curr["جمع کل پورسانت"],
    "جمع کل فروش": (acc["جمع کل فروش"] as number) + curr["جمع کل فروش"],
  }), { "نام کارشناس": "جمع کل", "فروش خالص تارگت": 0, "پورسانت تارگت": 0, "فروش خالص بتا": 0, "پورسانت بتا": 0, "فروش خالص سایر": 0, "پورسانت سایر": 0, "پاداش حجم کل": 0, "جمع کل پورسانت": 0, "جمع کل فروش": 0 });

  summaryRows.push(totalSummary);

  // --- SHEET 2: Detailed Customer Breakdown (ریز فروش مشتریان) ---
  const detailRows: any[] = [];
  
  const resolveRepName = (rawSubgroup: string, isBeta: boolean): string => {
    if (!isBeta) return rawSubgroup;
    const extracted = extractBetaRepName(rawSubgroup);
    const mapping = snapshot.betaMappings.find(m => m.betaSubgroup === extracted);
    const exactMapping = snapshot.betaMappings.find(m => m.betaSubgroup === rawSubgroup);
    return mapping ? mapping.assignedRepName : (exactMapping ? exactMapping.assignedRepName : extracted);
  };

  const repCustomerMap = new Map<string, Map<string, { 
    target: number, beta: number, other: number, 
    targetDed: number, betaDed: number, otherDed: number 
  }>>();

  const addToMap = (rep: string, customer: string, field: 'target'|'beta'|'other'|'targetDed'|'betaDed'|'otherDed', value: number) => {
     if(!rep) return;
     if (!repCustomerMap.has(rep)) repCustomerMap.set(rep, new Map());
     const customers = repCustomerMap.get(rep)!;
     if (!customers.has(customer)) customers.set(customer, { target: 0, beta: 0, other: 0, targetDed: 0, betaDed: 0, otherDed: 0 });
     const data = customers.get(customer)!;
     data[field] += value;
  };

  snapshot.personSales.forEach(p => {
     const rep = resolveRepName(p.subgroup, p.isBeta);
     if(rep) {
        if (!repCustomerMap.has(rep)) repCustomerMap.set(rep, new Map());
        const customers = repCustomerMap.get(rep)!;
        if (!customers.has(p.customerName)) {
           customers.set(p.customerName, { target: 0, beta: 0, other: 0, targetDed: 0, betaDed: 0, otherDed: 0 });
        }
     }
  });

  snapshot.goodsSales.forEach(good => {
      const personRecord = snapshot.personSales.find(p => p.customerName === good.buyerName);
      if (personRecord) {
          const rep = resolveRepName(personRecord.subgroup, personRecord.isBeta);
          const net = good.netSales || 0;
          if (personRecord.isBeta) {
              addToMap(rep, good.buyerName, 'beta', net);
          } else if (good.productCode?.toUpperCase().startsWith('TG')) {
              addToMap(rep, good.buyerName, 'target', net);
          } else {
              addToMap(rep, good.buyerName, 'other', net);
          }
      }
  });

  snapshot.expenses.forEach(exp => {
      if (exp.assignedCategory) {
          let repName = exp.linkedRep; 
          if (repName) {
             const pRecord = snapshot.personSales.find(p => p.customerName === exp.executorName);
             if (pRecord) {
                 const resolvedRep = resolveRepName(pRecord.subgroup, pRecord.isBeta);
                 const amt = exp.amount || 0;
                 if (exp.assignedCategory === SalesCategory.TARGET) addToMap(resolvedRep, exp.executorName, 'targetDed', amt);
                 if (exp.assignedCategory === SalesCategory.BETA) addToMap(resolvedRep, exp.executorName, 'betaDed', amt);
                 if (exp.assignedCategory === SalesCategory.OTHER) addToMap(resolvedRep, exp.executorName, 'otherDed', amt);
             }
          }
      }
  });

  repCustomerMap.forEach((customers, repName) => {
      customers.forEach((data, customerName) => {
          const pRecord = snapshot.personSales.find(p => p.customerName === customerName);
          const totalCalc = data.target + data.beta + data.other;
          if (totalCalc === 0 && pRecord && pRecord.netSales !== 0) {
              if (pRecord.isBeta) data.beta += pRecord.netSales;
              else data.other += pRecord.netSales;
          }

          if (data.target !== 0 || data.beta !== 0 || data.other !== 0 || 
              data.targetDed !== 0 || data.betaDed !== 0 || data.otherDed !== 0) {
              
              detailRows.push({
                  "نام کارشناس": repName,
                  "نام مشتری / خریدار": customerName,
                  "فروش تارگت": data.target,
                  "کسورات تارگت": data.targetDed,
                  "فروش بتا": data.beta,
                  "کسورات بتا": data.betaDed,
                  "فروش سایر": data.other,
                  "کسورات سایر": data.otherDed,
                  "جمع خالص": (data.target + data.beta + data.other) - (data.targetDed + data.betaDed + data.otherDed)
              });
          }
      });
  });

  detailRows.sort((a, b) => a["نام کارشناس"].localeCompare(b["نام کارشناس"]));


  // --- SHEET 3: Managers Summary (مدیران - خلاصه) ---
  const managerRows = managersData.map(m => ({
     "نام مدیر": m.managerName,
     "فروش تیمی تارگت": m.teamTotalTarget,
     "فروش تیمی بتا": m.teamTotalBeta,
     "فروش تیمی سایر": m.teamTotalOther,
     "جمع کسورات تیم": m.teamTotalDeductions,
     "پورسانت دریافتی": m.commission
  }));

  // --- SHEET 4: Team Breakdown (عملکرد تیم‌ها - جدید) ---
  const teamRows: any[] = [];
  managersData.forEach(mgr => {
      mgr.subordinatesDetails.forEach(sub => {
          teamRows.push({
              "نام مدیر": mgr.managerName,
              "زیرمجموعه (کارشناس)": sub.repName,
              "خالص تارگت": sub.targetNet,
              "خالص بتا": sub.betaNet,
              "خالص سایر": sub.otherNet,
              "جمع کل خالص": sub.totalNet
          });
      });
  });

  // --- GENERATE WORKBOOK ---
  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  const wsDetails = XLSX.utils.json_to_sheet(detailRows);
  const wsManagers = XLSX.utils.json_to_sheet(managerRows);
  const wsTeam = XLSX.utils.json_to_sheet(teamRows);

  // Set column widths
  const wscols = [
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  wsSummary['!cols'] = wscols;
  wsDetails['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
  wsManagers['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  wsTeam['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

  XLSX.utils.book_append_sheet(wb, wsSummary, "خلاصه عملکرد");
  XLSX.utils.book_append_sheet(wb, wsDetails, "ریز فروش مشتریان");
  XLSX.utils.book_append_sheet(wb, wsManagers, "مدیران");
  XLSX.utils.book_append_sheet(wb, wsTeam, "عملکرد تیم‌ها");

  // --- SAVE FILE ---
  XLSX.writeFile(wb, `Commission_Report_${year}_${month}.xlsx`);
};
