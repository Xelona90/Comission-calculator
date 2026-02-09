
import React, { useState, useMemo } from 'react';
import { AggregatedSalesData, ManagerSalesData, PersonSalesRow, GoodsSalesRow, BetaMapping, ExpenseRow } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { analyzeSalesData } from '../services/geminiService';
import { Bot, RefreshCcw, FileText, Banknote, Users, Sparkles, Briefcase, Filter, Printer, Percent } from 'lucide-react';

interface DashboardProps {
  data: AggregatedSalesData[];
  managersData: ManagerSalesData[];
  personSales?: PersonSalesRow[];
  goodsSales?: GoodsSalesRow[];
  betaMappings?: BetaMapping[];
  expenses?: ExpenseRow[];
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
  expenses = []
}) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedRep, setSelectedRep] = useState<string>('all');

  // Helper to resolve Rep for a customer
  const resolveRepName = (rawSubgroup: string, isBeta: boolean): string => {
    if (!isBeta) return rawSubgroup;
    const mapping = betaMappings.find(m => m.betaSubgroup === rawSubgroup);
    return mapping ? mapping.assignedRepName : rawSubgroup;
  };

  // Filter Data Logic (Aggregated)
  const filteredData = useMemo(() => {
    if (selectedRep === 'all') return data;
    return data.filter(d => d.repName === selectedRep);
  }, [data, selectedRep]);

  // Customer Breakdown Logic (Active when a Rep is selected)
  const customerBreakdown = useMemo(() => {
    if (selectedRep === 'all') return [];

    const customers: Record<string, { 
      name: string, 
      target: number, 
      beta: number, 
      other: number, 
      total: number,
      deductions: number 
    }> = {};

    // 1. Find all customers belonging to this Rep
    const repCustomers = personSales.filter(p => {
       const rep = resolveRepName(p.subgroup, p.isBeta);
       return rep === selectedRep;
    });
    
    // Create a map for quick lookup
    const customerNames = new Set(repCustomers.map(c => c.customerName));

    // 2. Iterate Goods to calculate breakdown
    goodsSales.forEach(good => {
       if (customerNames.has(good.buyerName)) {
           if (!customers[good.buyerName]) {
               customers[good.buyerName] = { name: good.buyerName, target: 0, beta: 0, other: 0, total: 0, deductions: 0 };
           }
           
           const net = good.netSales || 0;
           
           if (good.productCode && good.productCode.toUpperCase().startsWith('TG')) {
              customers[good.buyerName].target += net;
           } else {
              // Check if the customer is Beta to classify non-TG goods
              const pRecord = repCustomers.find(p => p.customerName === good.buyerName);
              if (pRecord?.isBeta) {
                 customers[good.buyerName].beta += net;
              } else {
                 customers[good.buyerName].other += net;
              }
           }
           customers[good.buyerName].total += net;
       }
    });

    // 3. Handle Expenses
    expenses.forEach(exp => {
      if (exp.assignedCategory && customerNames.has(exp.executorName)) {
         if (!customers[exp.executorName]) {
             customers[exp.executorName] = { name: exp.executorName, target: 0, beta: 0, other: 0, total: 0, deductions: 0 };
         }
         customers[exp.executorName].deductions += exp.amount;
      }
    });

    // Ensure all customers from personSales appear
    repCustomers.forEach(p => {
        if (!customers[p.customerName]) {
            customers[p.customerName] = { 
                name: p.customerName, 
                target: 0, 
                beta: p.isBeta ? p.netSales : 0, 
                other: !p.isBeta ? p.netSales : 0,
                total: p.netSales,
                deductions: 0
            };
        }
    });

    return Object.values(customers).sort((a,b) => b.total - a.total);
  }, [selectedRep, personSales, goodsSales, expenses, betaMappings]);


  // Chart Data Preparation
  const chartData = useMemo(() => {
    if (selectedRep === 'all') {
      return filteredData.map(d => ({
        name: d.repName,
        value: d.totalNet,
        fill: '#3b82f6' 
      })).sort((a, b) => b.value - a.value); 
    } else {
      const rep = filteredData[0];
      if (!rep) return [];
      return [
        { name: 'تارگت (TG)', value: rep.targetSales, fill: '#3b82f6' },
        { name: 'بتا (Beta)', value: rep.betaSales, fill: '#ec4899' },
        { name: 'سایر (Other)', value: rep.otherSales, fill: '#10b981' }
      ];
    }
  }, [filteredData, selectedRep]);

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
    <div className="space-y-8 animate-fade-in text-gray-900">
      
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

         <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-900 shadow-lg shadow-slate-200 transition font-bold"
         >
            <Printer size={18} />
            چاپ گزارش (A4)
         </button>
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
                  <h3 className="text-lg font-bold text-purple-900">پورسانت مدیران فروش</h3>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                     <thead className="bg-gray-50 text-gray-600">
                        <tr>
                           <th className="p-4">نام مدیر</th>
                           <th className="p-4">مجموع فروش تیم (تارگت)</th>
                           <th className="p-4">مجموع فروش تیم (بتا)</th>
                           <th className="p-4">مجموع فروش تیم (سایر)</th>
                           <th className="p-4 text-red-500">مجموع کسورات تیم</th>
                           <th className="p-4 text-purple-700 font-bold text-lg">پورسانت نهایی</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {managersData.map((mgr, idx) => (
                           <tr key={idx} className="hover:bg-purple-50/30">
                              <td className="p-4 font-bold">{mgr.managerName}</td>
                              <td className="p-4">{formatCurrency(mgr.teamTotalTarget)}</td>
                              <td className="p-4">{formatCurrency(mgr.teamTotalBeta)}</td>
                              <td className="p-4">{formatCurrency(mgr.teamTotalOther)}</td>
                              <td className="p-4 text-red-500">{formatCurrency(mgr.teamTotalDeductions)}</td>
                              <td className="p-4 font-black text-purple-700 text-lg">{formatCurrency(mgr.commission)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* Charts */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 mb-6 shrink-0 border-r-4 border-blue-500 pr-3 flex items-center justify-between">
               <span>
                 {selectedRep === 'all' ? 'مقایسه عملکرد کارشناسان (فروش کل)' : `ترکیب فروش کارشناس: ${selectedRep}`}
               </span>
               {selectedRep !== 'all' && <span className="text-xs font-normal text-gray-400">تفکیک بر اساس دسته‌بندی کالا</span>}
            </h3>
            <div className="w-full flex-1 min-h-0 text-xs">
               <ResponsiveContainer width="100%" height="100%">
               <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
               >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{fill: '#4b5563', fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(val)} tick={{fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                     formatter={(value: number) => formatCurrency(value)} 
                     contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', color: '#111827' }}
                     itemStyle={{ color: '#111827', fontWeight: 600 }}
                     cursor={{fill: '#f9fafb'}}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                  <Bar dataKey="value" name="مبلغ فروش" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
               </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

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

                        <td className="p-4 text-gray-900 font-black text-base bg-gray-50 sticky left-0 group-hover:bg-gray-100 shadow-sm">{formatCurrency(row.totalCommission || 0)}</td>
                     </tr>
                  ))}

                  {/* --- RENDER LOGIC: CUSTOMER BREAKDOWN --- */}
                  {selectedRep !== 'all' && customerBreakdown.map((row) => (
                     <tr key={row.name} className="hover:bg-gray-50 transition-colors group text-xs">
                        <td className="p-4 font-bold text-gray-800 sticky right-0 bg-white group-hover:bg-gray-50 shadow-sm truncate max-w-[200px]" title={row.name}>{row.name}</td>
                        
                        <td className="p-4 text-gray-600 bg-blue-50/5 group-hover:bg-blue-50/20">{formatCurrency(row.target)}</td>
                        <td className="p-4 text-gray-300 bg-blue-50/5 group-hover:bg-blue-50/20">-</td>
                        <td className="p-4 text-gray-300 bg-blue-50/20 group-hover:bg-blue-50/40 border-l border-blue-100">-</td>

                        <td className="p-4 text-gray-600 bg-pink-50/5 group-hover:bg-pink-50/20">{formatCurrency(row.beta)}</td>
                        <td className="p-4 text-gray-300 bg-pink-50/5 group-hover:bg-pink-50/20">-</td>
                        <td className="p-4 text-gray-300 bg-pink-50/20 group-hover:bg-pink-50/40 border-l border-pink-100">-</td>

                        <td className="p-4 text-gray-600 bg-emerald-50/5 group-hover:bg-emerald-50/20">{formatCurrency(row.other)}</td>
                        <td className="p-4 text-red-400 bg-emerald-50/5 group-hover:bg-emerald-50/20">{row.deductions > 0 ? `(${formatCurrency(row.deductions)})` : '-'}</td>
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
                           <td className="border border-black p-2 font-bold bg-gray-100">{formatCurrency(row.totalCommission || 0)}</td>
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

               {/* Chart Section */}
               <div className="border border-gray-300 rounded-xl p-4 bg-white">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2">نمودار ترکیب فروش (Target / Beta / Other)</h3>
                  <div style={{ width: '100%', height: '200px' }}>
                     <ResponsiveContainer>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                           <XAxis type="number" hide />
                           <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fill: '#000', fontWeight: 'bold'}} />
                           <Bar dataKey="value" barSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                              {chartData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                              <LabelList dataKey="value" position="right" formatter={(val: number) => formatCurrency(val)} fontSize={10} fill="#000" />
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
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
                               <td className="p-2 border-r border-gray-200 font-bold truncate max-w-[200px]">{row.name}</td>
                               <td className="p-2 border-r border-gray-200 text-center">{row.target > 0 ? formatCurrency(row.target) : '-'}</td>
                               <td className="p-2 border-r border-gray-200 text-center">{row.beta > 0 ? formatCurrency(row.beta) : '-'}</td>
                               <td className="p-2 border-r border-gray-200 text-center">{row.other > 0 ? formatCurrency(row.other) : '-'}</td>
                               <td className="p-2 border-r border-gray-200 text-center text-red-600">{row.deductions > 0 ? formatCurrency(row.deductions) : '-'}</td>
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
