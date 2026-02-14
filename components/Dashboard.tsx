
import React, { useState, useMemo } from 'react';
import { AggregatedSalesData, ManagerSalesData, PersonSalesRow, GoodsSalesRow, BetaMapping, ExpenseRow, SalesCategory } from '../types';
import { analyzeSalesData } from '../services/geminiService';
import { extractBetaRepName } from '../services/calculationService';
import { Bot, RefreshCcw, FileText, Banknote, Users, Sparkles, Briefcase, Filter, Printer, Percent, Save, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

interface DashboardProps {
  data: AggregatedSalesData[];
  managersData: ManagerSalesData[];
  personSales?: PersonSalesRow[];
  goodsSales?: GoodsSalesRow[];
  betaMappings?: BetaMapping[];
  expenses?: ExpenseRow[];
  onSaveReport?: (year: number, month: number) => Promise<boolean>; // New Prop
}

const formatCurrency = (val: number) => {
  if (!Number.isFinite(val)) return '0';
  return new Intl.NumberFormat('fa-IR').format(Math.round(val));
};

const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  managersData, 
  personSales = [], 
  goodsSales = [], 
  betaMappings = [],
  expenses = [],
  onSaveReport
}) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [expandedManager, setExpandedManager] = useState<string | null>(null);
  
  // Save Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveYear, setSaveYear] = useState(1403);
  const [saveMonth, setSaveMonth] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Helper to resolve Rep for a customer (Synced with calculationService logic)
  const resolveRepName = (rawSubgroup: string, isBeta: boolean): string => {
    if (!isBeta) return rawSubgroup;
    
    // 1. Extract the name first (matches how keys are stored in betaMappings)
    const extracted = extractBetaRepName(rawSubgroup);
    
    // 2. Find mapping based on extracted name
    const mapping = betaMappings.find(m => m.betaSubgroup === extracted);
    
    // 3. Return mapped name, or extracted name if no mapping exists
    return mapping ? mapping.assignedRepName : extracted;
  };

  // Filter Data Logic (Aggregated)
  const filteredData = useMemo(() => {
    if (selectedRep === 'all') return data;
    return data.filter(d => d.repName === selectedRep);
  }, [data, selectedRep]);

  // Customer Breakdown Logic (Active when a Rep is selected)
  // UPDATED: Aggregates Beta customers under the extracted Beta Rep Name
  const customerBreakdown = useMemo(() => {
    if (selectedRep === 'all') return [];

    const rows: Record<string, { 
      name: string, 
      isBetaGroup: boolean,
      target: number, 
      targetDeductions: number,
      beta: number, 
      betaDeductions: number,
      other: number, 
      otherDeductions: number,
      total: number,
      totalDeductions: number 
    }> = {};

    // 1. Identify all customers belonging to this Rep
    const repCustomers = personSales.filter(p => {
       const rep = resolveRepName(p.subgroup, p.isBeta);
       return rep === selectedRep;
    });
    
    // Map customerName -> Row Key (Either customerName OR Extracted Beta Name)
    const customerKeyMap = new Map<string, { key: string, isBeta: boolean }>();
    
    repCustomers.forEach(p => {
        let key = p.customerName;
        let isBeta = false;

        if (p.isBeta && p.subgroup) {
            // IF BETA: Aggregate by the extracted name (e.g., "علی حمزه پور")
            key = extractBetaRepName(p.subgroup);
            isBeta = true;
        }

        customerKeyMap.set(p.customerName, { key, isBeta });

        // Initialize row if not exists
        if (!rows[key]) {
            rows[key] = { 
                name: key, 
                isBetaGroup: isBeta,
                target: 0, 
                targetDeductions: 0,
                beta: 0, 
                betaDeductions: 0,
                other: 0, 
                otherDeductions: 0,
                total: 0, 
                totalDeductions: 0 
            };
        }
    });

    // 2. Iterate Goods to calculate breakdown
    // UPDATED PRIORITY: Beta First -> Target -> Other
    goodsSales.forEach(good => {
       const mapping = customerKeyMap.get(good.buyerName);
       if (mapping) {
           const { key, isBeta } = mapping;
           const net = good.netSales || 0;

           if (isBeta) {
               rows[key].beta += net;
           } else if (good.productCode && good.productCode.toUpperCase().startsWith('TG')) {
               rows[key].target += net;
           } else {
               rows[key].other += net;
           }
           rows[key].total += net;
       }
    });

    // 3. Handle Expenses - Fix: Split by category
    expenses.forEach(exp => {
      if (exp.assignedCategory) {
         const mapping = customerKeyMap.get(exp.executorName);
         if (mapping) {
             const { key } = mapping;
             const amt = exp.amount || 0;

             if (exp.assignedCategory === SalesCategory.TARGET) {
                rows[key].targetDeductions += amt;
             } else if (exp.assignedCategory === SalesCategory.BETA) {
                rows[key].betaDeductions += amt;
             } else if (exp.assignedCategory === SalesCategory.OTHER) {
                rows[key].otherDeductions += amt;
             }
             
             rows[key].totalDeductions += amt;
         }
      }
    });

    // 4. Ensure totals from personSales are reflected if goods were missing/partial
    repCustomers.forEach(p => {
        const { key, isBeta } = customerKeyMap.get(p.customerName)!;
        // If row has 0 total but person has sales, dump it into beta/other
        if (rows[key].total === 0 && p.netSales !== 0) {
             if (isBeta) rows[key].beta += p.netSales;
             else rows[key].other += p.netSales;
             rows[key].total += p.netSales;
        }
    });

    return Object.values(rows).sort((a,b) => b.total - a.total);
  }, [selectedRep, personSales, goodsSales, expenses, betaMappings]);

  // Totals based on filtered data
  const totalNetSales = filteredData.reduce((acc, curr) => acc + curr.totalNet, 0);
  const totalCommission = filteredData.reduce((acc, curr) => acc + (curr.totalCommission || 0), 0) + 
                          (selectedRep === 'all' ? managersData.reduce((acc, curr) => acc + curr.commission, 0) : 0);

  // Dynamic Content for Third Card
  const ThirdCardContent = useMemo(() => {
    if (selectedRep === 'all') {
       return {
         title: 'تعداد پرسنل',
         icon: <Users size={22} />,
         colorClass: 'bg-purple-100 text-purple-600',
         value: (
           <>
            {filteredData.length} <span className="text-sm font-normal text-gray-400">کارشناس</span> 
            {` + ${managersData.length} مدیر`}
           </>
         )
       };
    } else {
       const rep = filteredData[0];
       const rate = rep && rep.totalNet > 0 ? ((rep.totalCommission || 0) / rep.totalNet) * 100 : 0;
       return {
         title: 'نرخ موثر پورسانت',
         icon: <Percent size={22} />,
         colorClass: 'bg-orange-100 text-orange-600',
         value: (
           <>
            {rate.toFixed(2)} <span className="text-sm font-normal text-gray-400">درصد از فروش</span> 
           </>
         )
       };
    }
  }, [selectedRep, filteredData, managersData]);

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    const result = await analyzeSalesData(filteredData);
    setAiAnalysis(result);
    setLoadingAi(false);
  };

  const handlePrint = () => {
    window.print();
  };
  
  const handleSaveClick = async () => {
     if (onSaveReport) {
        setIsSaving(true);
        const success = await onSaveReport(saveYear, saveMonth);
        setIsSaving(false);
        if (success) {
           setShowSaveModal(false);
           alert('گزارش با موفقیت در پایگاه داده ذخیره شد.');
        } else {
           alert('خطا در ذخیره گزارش.');
        }
     }
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-gray-200">
        <p className="text-gray-900 font-medium">هیچ داده‌ای برای نمایش وجود ندارد.</p>
      </div>
    );
  }

  // Helper for Print Date
  const printDate = new Date().toLocaleDateString('fa-IR');

  return (
    <div className="space-y-8 animate-fade-in text-gray-900 relative">
      
      {/* Save Report Modal */}
      {showSaveModal && (
         <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
               <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2"><Save size={18}/> ذخیره گزارش نهایی</h3>
                  <button onClick={() => setShowSaveModal(false)} className="hover:bg-blue-700 p-1 rounded-full"><X size={18}/></button>
               </div>
               <div className="p-6 space-y-4">
                  <div>
                     <label className="block text-sm font-bold text-gray-700 mb-1">سال</label>
                     <input 
                        type="number" 
                        value={saveYear} 
                        onChange={(e) => setSaveYear(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg p-2 text-center font-mono font-bold" 
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-gray-700 mb-1">ماه</label>
                     <select 
                        value={saveMonth} 
                        onChange={(e) => setSaveMonth(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg p-2 text-center font-bold"
                     >
                        <option value={1}>فروردین</option>
                        <option value={2}>اردیبهشت</option>
                        <option value={3}>خرداد</option>
                        <option value={4}>تیر</option>
                        <option value={5}>مرداد</option>
                        <option value={6}>شهریور</option>
                        <option value={7}>مهر</option>
                        <option value={8}>آبان</option>
                        <option value={9}>آذر</option>
                        <option value={10}>دی</option>
                        <option value={11}>بهمن</option>
                        <option value={12}>اسفند</option>
                     </select>
                  </div>
                  <div className="pt-2">
                     <button 
                        onClick={handleSaveClick}
                        disabled={isSaving}
                        className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                        {isSaving ? <RefreshCcw className="animate-spin" size={18}/> : <Check size={18}/>}
                        {isSaving ? 'در حال ذخیره...' : 'تایید و ذخیره'}
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* --- HEADER: FILTER & PRINT ACTIONS (HIDDEN ON PRINT) --- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:hidden">
         <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 text-gray-500 font-bold text-sm bg-gray-50 px-3 py-2 rounded-lg">
               <Filter size={18} />
               فیلتر:
            </div>
            <select 
               className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:border-blue-500 outline-none w-full md:w-64"
               value={selectedRep}
               onChange={(e) => setSelectedRep(e.target.value)}
            >
               <option value="all">نمایش همه (لیست کامل)</option>
               {data.map(d => (
                  <option key={d.repName} value={d.repName}>{d.repName}</option>
               ))}
            </select>
         </div>

         <div className="flex items-center gap-3">
             {onSaveReport && (
                <button 
                  onClick={() => setShowSaveModal(true)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 shadow-md shadow-emerald-100 transition font-bold"
                >
                  <Save size={18} />
                  ذخیره در سیستم
                </button>
             )}
             <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-900 shadow-lg shadow-slate-200 transition font-bold"
             >
                <Printer size={18} />
                چاپ گزارش (A4)
             </button>
         </div>
      </div>

      {/* --- SCREEN CONTENT (HIDDEN ON PRINT) --- */}
      <div className="space-y-8 print:hidden">
         {/* Top Cards */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:shadow-blue-50 transition-all group">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                  <Banknote size={22} />
               </div>
               <h4 className="text-gray-500 text-sm font-bold">فروش خالص {selectedRep !== 'all' ? '(انتخابی)' : 'کل'}</h4>
            </div>
            <p className="text-2xl font-black text-gray-800 mt-2">
               {formatCurrency(totalNetSales)} <span className="text-xs text-gray-400 font-normal">ریال</span>
            </p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:shadow-emerald-50 transition-all group">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                  <FileText size={22} />
               </div>
               <h4 className="text-gray-500 text-sm font-bold">پورسانت {selectedRep !== 'all' ? '(انتخابی)' : 'کل'}</h4>
            </div>
            <p className="text-2xl font-black text-gray-800 mt-2">
               {formatCurrency(totalCommission)} <span className="text-xs text-gray-400 font-normal">ریال</span>
            </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:shadow-purple-50 transition-all group">
            <div className="flex items-center gap-3 mb-2">
               <div className={`p-2.5 rounded-xl group-hover:scale-110 transition-transform ${ThirdCardContent.colorClass}`}>
                  {ThirdCardContent.icon}
               </div>
               <h4 className="text-gray-500 text-sm font-bold">{ThirdCardContent.title}</h4>
            </div>
            <p className="text-2xl font-black text-gray-800 mt-2">
               {ThirdCardContent.value}
            </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-900 to-blue-900 p-6 rounded-xl shadow-lg text-white relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
               <div className="flex justify-between items-start relative z-10">
                  <div>
                     <h4 className="text-indigo-100 text-sm font-bold flex items-center gap-2">
                        <Sparkles size={14} className="text-yellow-300" />
                        هوش مصنوعی
                     </h4>
                     <p className="text-xs text-indigo-300 mt-1">تحلیل عملکرد {selectedRep !== 'all' ? 'فردی' : 'تیم'}</p>
                  </div>
                  <Bot className="text-white opacity-80" />
               </div>
               <button 
                  onClick={handleAiAnalysis}
                  disabled={loadingAi}
                  className="mt-4 w-full relative z-10 bg-white/10 hover:bg-white/20 text-white text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition border border-white/10 font-medium backdrop-blur-sm"
               >
                  {loadingAi ? 'در حال تحلیل...' : 'دریافت تحلیل هوشمند'}
                  {!loadingAi && <RefreshCcw size={14} />}
               </button>
            </div>
         </div>

         {/* AI Result Section */}
         {aiAnalysis && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 animate-fade-in shadow-sm">
               <h3 className="text-lg font-bold text-indigo-900 mb-3 flex items-center gap-2">
                  <Bot size={22} className="text-indigo-600" />
                  تحلیل هوشمند
               </h3>
               <div className="prose prose-sm max-w-none text-indigo-950 whitespace-pre-wrap leading-relaxed">
                  {aiAnalysis}
               </div>
            </div>
         )}

         {/* Managers Table (Only Show if All selected) */}
         {selectedRep === 'all' && managersData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden mb-8">
               <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                  <Briefcase className="text-purple-600" size={20} />
                  <h3 className="text-lg font-bold text-purple-900">عملکرد مدیران فروش و سرپرستان (بر اساس فروش تیم)</h3>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                     <thead className="bg-gray-50 text-gray-600">
                        <tr>
                           <th className="p-4">نام مدیر</th>
                           <th className="p-4">فروش تیم (تارگت)</th>
                           <th className="p-4">فروش تیم (بتا)</th>
                           <th className="p-4">فروش تیم (سایر)</th>
                           <th className="p-4 text-red-500">کسورات تیم</th>
                           <th className="p-4 text-purple-700 font-bold text-lg">پورسانت مدیر</th>
                           <th className="p-4 text-center">جزئیات</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {managersData.map((mgr, idx) => (
                           <React.Fragment key={idx}>
                           <tr className={`hover:bg-purple-50/30 transition-colors ${expandedManager === mgr.managerName ? 'bg-purple-50/50' : ''}`}>
                              <td className="p-4 font-bold">{mgr.managerName}</td>
                              <td className="p-4">{formatCurrency(mgr.teamTotalTarget)}</td>
                              <td className="p-4">{formatCurrency(mgr.teamTotalBeta)}</td>
                              <td className="p-4">{formatCurrency(mgr.teamTotalOther)}</td>
                              <td className="p-4 text-red-500">{formatCurrency(mgr.teamTotalDeductions)}</td>
                              <td className="p-4 font-black text-purple-700 text-lg">{formatCurrency(mgr.commission)}</td>
                              <td className="p-4 text-center">
                                 <button 
                                    onClick={() => setExpandedManager(expandedManager === mgr.managerName ? null : mgr.managerName)}
                                    className="p-1 hover:bg-purple-100 rounded-full text-purple-600 transition"
                                 >
                                    {expandedManager === mgr.managerName ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                 </button>
                              </td>
                           </tr>
                           {/* Expanded Detail Row */}
                           {expandedManager === mgr.managerName && (
                              <tr className="bg-gray-50/50">
                                 <td colSpan={7} className="p-4 animate-fade-in">
                                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                       <h5 className="font-bold text-sm text-gray-600 mb-2 border-b border-gray-100 pb-2 flex items-center gap-2">
                                          <Users size={14}/>
                                          ریز عملکرد زیرمجموعه:
                                       </h5>
                                       <table className="w-full text-xs text-right">
                                          <thead className="bg-gray-100 text-gray-500">
                                             <tr>
                                                <th className="p-2">نام کارشناس زیرمجموعه</th>
                                                <th className="p-2">خالص تارگت</th>
                                                <th className="p-2">خالص بتا</th>
                                                <th className="p-2">خالص سایر</th>
                                                <th className="p-2">جمع خالص</th>
                                             </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                             {mgr.subordinatesDetails.map((sub, sIdx) => (
                                                <tr key={sIdx}>
                                                   <td className="p-2 font-medium">{sub.repName}</td>
                                                   <td className="p-2 text-gray-600">{formatCurrency(sub.targetNet)}</td>
                                                   <td className="p-2 text-gray-600">{formatCurrency(sub.betaNet)}</td>
                                                   <td className="p-2 text-gray-600">{formatCurrency(sub.otherNet)}</td>
                                                   <td className="p-2 font-bold text-gray-800">{formatCurrency(sub.totalNet)}</td>
                                                </tr>
                                             ))}
                                          </tbody>
                                       </table>
                                    </div>
                                 </td>
                              </tr>
                           )}
                           </React.Fragment>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* Detailed Table (Adaptive) */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
               <h3 className="text-lg font-extrabold text-gray-800 border-r-4 border-emerald-500 pr-3">
                  {selectedRep === 'all' ? 'پورسانت کارشناسان' : `ریز فروش مشتریان: ${selectedRep}`}
               </h3>
               <span className="text-xs font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                  {selectedRep === 'all' ? filteredData.length : customerBreakdown.length} رکورد
               </span>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-right text-sm whitespace-nowrap">
                  <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                     <th className="p-2 border-b border-gray-200"></th>
                     <th colSpan={3} className="p-2 border-b border-gray-200 text-center bg-blue-50/50 text-blue-800 border-x border-blue-100">تارگت (TG)</th>
                     <th colSpan={3} className="p-2 border-b border-gray-200 text-center bg-pink-50/50 text-pink-800 border-x border-pink-100">بتا (Beta)</th>
                     <th colSpan={3} className="p-2 border-b border-gray-200 text-center bg-emerald-50/50 text-emerald-800 border-x border-emerald-100">سایر (Other)</th>
                     <th className="p-2 border-b border-gray-200"></th>
                  </tr>
                  <tr className="bg-gray-50/80 text-gray-600">
                     <th className="p-4 font-bold border-b border-gray-200 sticky right-0 bg-gray-50 z-10 shadow-sm">
                        {selectedRep === 'all' ? 'کارشناس' : 'نام مشتری / خریدار'}
                     </th>
                     
                     <th className="p-4 font-semibold border-b border-gray-200 bg-blue-50/20 text-blue-700">فروش خالص</th>
                     <th className="p-4 font-semibold border-b border-gray-200 bg-blue-50/20 text-red-500">کسورات</th>
                     <th className="p-4 font-bold border-b border-gray-200 bg-blue-50/50 text-blue-900 border-l border-blue-100">پورسانت</th>
                     
                     <th className="p-4 font-semibold border-b border-gray-200 bg-pink-50/20 text-pink-700">فروش خالص</th>
                     <th className="p-4 font-semibold border-b border-gray-200 bg-pink-50/20 text-red-500">کسورات</th>
                     <th className="p-4 font-bold border-b border-gray-200 bg-pink-50/50 text-pink-900 border-l border-pink-100">پورسانت</th>
                     
                     <th className="p-4 font-semibold border-b border-gray-200 bg-emerald-50/20 text-emerald-700">فروش خالص</th>
                     <th className="p-4 font-semibold border-b border-gray-200 bg-emerald-50/20 text-red-500">کسورات</th>
                     <th className="p-4 font-bold border-b border-gray-200 bg-emerald-50/50 text-emerald-900 border-l border-emerald-100">پورسانت</th>
                     
                     <th className="p-4 font-black border-b border-gray-200 text-gray-900 bg-gray-100 sticky left-0 z-10 shadow-sm">جمع کل پورسانت</th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                  
                  {/* --- RENDER LOGIC: ALL REPS --- */}
                  {selectedRep === 'all' && filteredData.map((row) => (
                     <tr key={row.repName} className="hover:bg-gray-50 transition-colors group">
                        <td className="p-4 font-bold text-gray-800 sticky right-0 bg-white group-hover:bg-gray-50 shadow-sm">{row.repName}</td>
                        
                        <td className="p-4 text-gray-500 bg-blue-50/5 group-hover:bg-blue-50/20">{formatCurrency(row.targetSales)}</td>
                        <td className="p-4 text-red-400 bg-blue-50/5 group-hover:bg-blue-50/20">{row.targetDeductions > 0 ? `(${formatCurrency(row.targetDeductions)})` : '-'}</td>
                        <td className="p-4 text-blue-700 font-bold bg-blue-50/20 group-hover:bg-blue-50/40 border-l border-blue-100">{formatCurrency(row.commissionTarget || 0)}</td>

                        <td className="p-4 text-gray-500 bg-pink-50/5 group-hover:bg-pink-50/20">{formatCurrency(row.betaSales)}</td>
                        <td className="p-4 text-red-400 bg-pink-50/5 group-hover:bg-pink-50/20">{row.betaDeductions > 0 ? `(${formatCurrency(row.betaDeductions)})` : '-'}</td>
                        <td className="p-4 text-pink-700 font-bold bg-pink-50/20 group-hover:bg-pink-50/40 border-l border-pink-100">{formatCurrency(row.commissionBeta || 0)}</td>

                        <td className="p-4 text-gray-500 bg-emerald-50/5 group-hover:bg-emerald-50/20">{formatCurrency(row.otherSales)}</td>
                        <td className="p-4 text-red-400 bg-emerald-50/5 group-hover:bg-emerald-50/20">{row.otherDeductions > 0 ? `(${formatCurrency(row.otherDeductions)})` : '-'}</td>
                        <td className="p-4 text-emerald-700 font-bold bg-emerald-50/20 group-hover:bg-emerald-50/40 border-l border-emerald-100">{formatCurrency(row.commissionOther || 0)}</td>

                        <td className="p-4 text-gray-900 font-black text-base bg-gray-50 sticky left-0 group-hover:bg-gray-100 shadow-sm">
                           {formatCurrency(row.totalCommission || 0)}
                           {(row.commissionTotal || 0) > 0 && <span className="block text-[10px] text-indigo-500 font-normal">+ پاداش حجم</span>}
                        </td>
                     </tr>
                  ))}

                  {/* --- RENDER LOGIC: CUSTOMER BREAKDOWN --- */}
                  {selectedRep !== 'all' && customerBreakdown.map((row) => (
                     <tr key={row.name} className={`hover:bg-gray-50 transition-colors group text-xs ${row.isBetaGroup ? 'bg-pink-50/30' : ''}`}>
                        <td className="p-4 font-bold text-gray-800 sticky right-0 bg-white group-hover:bg-gray-50 shadow-sm truncate max-w-[200px]" title={row.name}>
                           {row.isBetaGroup && <span className="inline-block w-2 h-2 rounded-full bg-pink-500 ml-2"></span>}
                           {row.name}
                           {row.isBetaGroup && <span className="text-[10px] text-pink-500 mr-1">(گروه بتا)</span>}
                        </td>
                        
                        <td className="p-4 text-gray-600 bg-blue-50/5 group-hover:bg-blue-50/20">{formatCurrency(row.target)}</td>
                        <td className="p-4 text-red-400 bg-blue-50/5 group-hover:bg-blue-50/20">{row.targetDeductions > 0 ? `(${formatCurrency(row.targetDeductions)})` : '-'}</td>
                        <td className="p-4 text-gray-300 bg-blue-50/20 group-hover:bg-blue-50/40 border-l border-blue-100">-</td>

                        <td className="p-4 text-gray-600 bg-pink-50/5 group-hover:bg-pink-50/20">{formatCurrency(row.beta)}</td>
                        <td className="p-4 text-red-400 bg-pink-50/5 group-hover:bg-pink-50/20">{row.betaDeductions > 0 ? `(${formatCurrency(row.betaDeductions)})` : '-'}</td>
                        <td className="p-4 text-gray-300 bg-pink-50/20 group-hover:bg-pink-50/40 border-l border-pink-100">-</td>

                        <td className="p-4 text-gray-600 bg-emerald-50/5 group-hover:bg-emerald-50/20">{formatCurrency(row.other)}</td>
                        <td className="p-4 text-red-400 bg-emerald-50/5 group-hover:bg-emerald-50/20">{row.otherDeductions > 0 ? `(${formatCurrency(row.otherDeductions)})` : '-'}</td>
                        <td className="p-4 text-gray-300 bg-emerald-50/20 group-hover:bg-emerald-50/40 border-l border-emerald-100">-</td>

                        <td className="p-4 text-gray-400 font-normal bg-gray-50 sticky left-0 group-hover:bg-gray-100 shadow-sm">-</td>
                     </tr>
                  ))}

                  </tbody>
                  {/* --- FOOTER FOR SINGLE REP: TOTALS --- */}
                  {selectedRep !== 'all' && filteredData.length > 0 && (
                     <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
                        <tr>
                            <td className="p-4 sticky right-0 bg-gray-100 shadow-sm">جمع کل (کارشناس)</td>
                            <td className="p-4 text-blue-800">{formatCurrency(filteredData[0].targetSales)}</td>
                            <td className="p-4 text-red-600">{filteredData[0].targetDeductions > 0 ? `(${formatCurrency(filteredData[0].targetDeductions)})` : '-'}</td>
                            <td className="p-4 text-blue-900 bg-blue-100 border-l border-blue-200">{formatCurrency(filteredData[0].commissionTarget || 0)}</td>

                            <td className="p-4 text-pink-800">{formatCurrency(filteredData[0].betaSales)}</td>
                            <td className="p-4 text-red-600">{filteredData[0].betaDeductions > 0 ? `(${formatCurrency(filteredData[0].betaDeductions)})` : '-'}</td>
                            <td className="p-4 text-pink-900 bg-pink-100 border-l border-pink-200">{formatCurrency(filteredData[0].commissionBeta || 0)}</td>

                            <td className="p-4 text-emerald-800">{formatCurrency(filteredData[0].otherSales)}</td>
                            <td className="p-4 text-red-600">{filteredData[0].otherDeductions > 0 ? `(${formatCurrency(filteredData[0].otherDeductions)})` : '-'}</td>
                            <td className="p-4 text-emerald-900 bg-emerald-100 border-l border-emerald-200">{formatCurrency(filteredData[0].commissionOther || 0)}</td>

                            <td className="p-4 text-gray-900 text-lg sticky left-0 bg-gray-200 shadow-sm">{formatCurrency(filteredData[0].totalCommission || 0)}</td>
                        </tr>
                        {/* New Row for Total Volume Bonus if exists */}
                        {(filteredData[0].commissionTotal || 0) > 0 && (
                           <tr className="bg-indigo-50 border-t border-indigo-200 text-indigo-900">
                              <td colSpan={10} className="p-4 text-right font-bold sticky right-0">
                                 پاداش حجم فروش کل (تارگت + بتا + سایر) - محاسبه شده بر اساس {formatCurrency(filteredData[0].totalNet)} ریال
                              </td>
                              <td className="p-4 font-black text-indigo-700 bg-indigo-100 sticky left-0 shadow-sm border-l-4 border-indigo-500">
                                 +{formatCurrency(filteredData[0].commissionTotal || 0)}
                              </td>
                           </tr>
                        )}
                     </tfoot>
                  )}
               </table>
            </div>
         </div>
      </div>

      {/* --- PRINT VIEW (VISIBLE ONLY ON PRINT) --- */}
      <div className="hidden print:block bg-white text-black p-4 space-y-6">
         {selectedRep === 'all' ? (
            /* ALL REPS REPORT */
            <div className="space-y-6">
               <div className="text-center border-b-2 border-black pb-4 mb-6">
                  <h1 className="text-2xl font-black mb-2">گزارش جامع پورسانت فروش</h1>
                  <p className="text-sm">تاریخ گزارش: {printDate}</p>
               </div>
               
               <table className="w-full text-xs text-right border-collapse border border-black">
                  <thead>
                     <tr className="bg-gray-200 font-bold border-b border-black">
                        <th className="border border-black p-2">نام کارشناس</th>
                        <th className="border border-black p-2">فروش تارگت</th>
                        <th className="border border-black p-2">پورسانت تارگت</th>
                        <th className="border border-black p-2">فروش بتا</th>
                        <th className="border border-black p-2">پورسانت بتا</th>
                        <th className="border border-black p-2">فروش سایر</th>
                        <th className="border border-black p-2">پورسانت سایر</th>
                        <th className="border border-black p-2 bg-gray-300">جمع کل پرداختی</th>
                     </tr>
                  </thead>
                  <tbody>
                     {data.map(row => (
                        <tr key={row.repName} className="border-b border-black">
                           <td className="border border-black p-2 font-bold">{row.repName}</td>
                           <td className="border border-black p-2">{formatCurrency(row.targetSales - row.targetDeductions)}</td>
                           <td className="border border-black p-2">{formatCurrency(row.commissionTarget || 0)}</td>
                           <td className="border border-black p-2">{formatCurrency(row.betaSales - row.betaDeductions)}</td>
                           <td className="border border-black p-2">{formatCurrency(row.commissionBeta || 0)}</td>
                           <td className="border border-black p-2">{formatCurrency(row.otherSales - row.otherDeductions)}</td>
                           <td className="border border-black p-2">{formatCurrency(row.commissionOther || 0)}</td>
                           <td className="border border-black p-2 font-bold bg-gray-100">
                              {formatCurrency(row.totalCommission || 0)}
                              {(row.commissionTotal || 0) > 0 && <span className="block text-[8px]">+ پاداش حجم</span>}
                           </td>
                        </tr>
                     ))}
                  </tbody>
                  <tfoot className="bg-gray-200 font-bold border-t-2 border-black">
                     <tr>
                        <td className="border border-black p-2">جمع کل</td>
                        <td className="border border-black p-2">-</td>
                        <td className="border border-black p-2">-</td>
                        <td className="border border-black p-2">-</td>
                        <td className="border border-black p-2">-</td>
                        <td className="border border-black p-2">-</td>
                        <td className="border border-black p-2">-</td>
                        <td className="border border-black p-2">{formatCurrency(data.reduce((a,c) => a + (c.totalCommission || 0), 0))}</td>
                     </tr>
                  </tfoot>
               </table>
            </div>
         ) : (
            /* SINGLE REP DASHBOARD CLONE FOR PRINT */
            <div className="space-y-6 font-sans">
               {/* Header */}
               <div className="flex justify-between items-end border-b-2 border-gray-800 pb-4">
                  <div>
                     <h1 className="text-2xl font-black text-gray-900">گزارش عملکرد و پورسانت فروش</h1>
                     <p className="text-gray-600 mt-1">کارشناس: <span className="font-bold text-black text-lg">{selectedRep}</span></p>
                  </div>
                  <div className="text-left text-sm text-gray-500">
                     <p>تاریخ گزارش: {printDate}</p>
                     <p className="mt-1 text-xs">واحد مالی و حسابداری</p>
                  </div>
               </div>

               {/* Summary Cards */}
               <div className="grid grid-cols-3 gap-4">
                  <div className="border border-gray-300 p-4 rounded-xl bg-white">
                     <div className="text-gray-500 text-xs font-bold mb-1">فروش خالص نهایی</div>
                     <div className="text-2xl font-black text-gray-900">{formatCurrency(filteredData[0]?.totalNet || 0)} <span className="text-xs font-normal">ریال</span></div>
                  </div>
                  <div className="border border-gray-300 p-4 rounded-xl bg-gray-50">
                     <div className="text-gray-500 text-xs font-bold mb-1">پورسانت نهایی قابل پرداخت</div>
                     <div className="text-2xl font-black text-blue-800">{formatCurrency(filteredData[0]?.totalCommission || 0)} <span className="text-xs font-normal">ریال</span></div>
                  </div>
                  <div className={`border border-gray-300 p-4 rounded-xl`}>
                     <div className="text-gray-500 text-xs font-bold mb-1">{ThirdCardContent.title}</div>
                     <div className="text-xl font-bold">{ThirdCardContent.value}</div>
                  </div>
               </div>

               {/* Detailed Table */}
               <div className="border border-gray-300 rounded-xl overflow-hidden mt-4">
                   <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-bold text-sm">ریز عملکرد به تفکیک خریداران</div>
                   <table className="w-full text-right text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 text-gray-700 border-b border-gray-300">
                           <th className="p-2 border-r border-gray-200 w-48">نام خریدار</th>
                           <th className="p-2 border-r border-gray-200 text-center">فروش تارگت</th>
                           <th className="p-2 border-r border-gray-200 text-center">فروش بتا</th>
                           <th className="p-2 border-r border-gray-200 text-center">فروش سایر</th>
                           <th className="p-2 border-r border-gray-200 text-center text-red-600">کسورات</th>
                           <th className="p-2 text-center font-bold">جمع کل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                         {customerBreakdown.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                               <td className="p-2 border-r border-gray-200 font-bold truncate max-w-[200px]">
                                 {row.name}
                                 {row.isBetaGroup && <span className="text-[10px] mr-1">(گروه بتا)</span>}
                               </td>
                               <td className="p-2 border-r border-gray-200 text-center">{row.target > 0 ? formatCurrency(row.target) : '-'}</td>
                               <td className="p-2 border-r border-gray-200 text-center">{row.beta > 0 ? formatCurrency(row.beta) : '-'}</td>
                               <td className="p-2 border-r border-gray-200 text-center">{row.other > 0 ? formatCurrency(row.other) : '-'}</td>
                               <td className="p-2 border-r border-gray-200 text-center text-red-600">{row.totalDeductions > 0 ? formatCurrency(row.totalDeductions) : '-'}</td>
                               <td className="p-2 text-center font-bold">{formatCurrency(row.total)}</td>
                            </tr>
                         ))}
                      </tbody>
                      <tfoot className="bg-gray-200 border-t-2 border-gray-400 font-bold text-black">
                         <tr>
                            <td className="p-2 border-r border-gray-400">جمع نهایی</td>
                            <td className="p-2 border-r border-gray-400 text-center">{formatCurrency(filteredData[0]?.targetSales || 0)}</td>
                            <td className="p-2 border-r border-gray-400 text-center">{formatCurrency(filteredData[0]?.betaSales || 0)}</td>
                            <td className="p-2 border-r border-gray-400 text-center">{formatCurrency(filteredData[0]?.otherSales || 0)}</td>
                            <td className="p-2 border-r border-gray-400 text-center text-red-700">({formatCurrency((filteredData[0]?.targetDeductions + filteredData[0]?.betaDeductions + filteredData[0]?.otherDeductions) || 0)})</td>
                            <td className="p-2 text-center">{formatCurrency(filteredData[0]?.totalNet || 0)}</td>
                         </tr>
                         {/* Print Footer: Total Volume Bonus */}
                         {(filteredData[0]?.commissionTotal || 0) > 0 && (
                            <tr className="bg-gray-300">
                               <td colSpan={5} className="p-2 border-r border-gray-400 text-right">
                                  + پاداش حجم فروش کل (تارگت + بتا + سایر)
                               </td>
                               <td className="p-2 text-center">
                                  {formatCurrency(filteredData[0]?.commissionTotal || 0)}
                               </td>
                            </tr>
                         )}
                      </tfoot>
                   </table>
               </div>

               {/* Signatures */}
               <div className="grid grid-cols-3 gap-8 mt-12 text-center text-sm pt-12 break-inside-avoid">
                  <div className="border-t border-black pt-2">
                     <p className="font-bold">امضاء کارشناس</p>
                  </div>
                  <div className="border-t border-black pt-2">
                     <p className="font-bold">امضاء مدیر فروش</p>
                  </div>
                  <div className="border-t border-black pt-2">
                     <p className="font-bold">امضاء امور مالی</p>
                  </div>
               </div>
            </div>
         )}
      </div>

    </div>
  );
};

export default Dashboard;
