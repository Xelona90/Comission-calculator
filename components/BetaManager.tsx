
import React, { useMemo } from 'react';
import { PersonSalesRow, BetaMapping } from '../types';
import { Share2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { extractBetaRepName } from '../services/calculationService';

interface BetaManagerProps {
  personSales: PersonSalesRow[];
  betaMappings: BetaMapping[];
  setBetaMappings: (mappings: BetaMapping[]) => void;
}

const BetaManager: React.FC<BetaManagerProps> = ({ personSales, betaMappings, setBetaMappings }) => {
  
  // 1. Identify all unique Beta Groups based on the extracted name in parentheses
  const betaSubgroups = useMemo(() => {
    const set = new Set<string>();
    personSales.forEach(p => {
      if (p.isBeta && p.subgroup) {
        // Use the extracted name (e.g. "امیررضا آجرلو") instead of the full string
        const extracted = extractBetaRepName(p.subgroup);
        set.add(extracted);
      }
    });
    return Array.from(set);
  }, [personSales]);

  // 2. Identify "Real Reps" (Non-beta subgroups) to populate the dropdown
  const realReps = useMemo(() => {
    const set = new Set<string>();
    personSales.forEach(p => {
      if (!p.isBeta && p.subgroup) {
        set.add(p.subgroup);
      }
    });
    return Array.from(set);
  }, [personSales]);

  const handleMappingChange = (betaName: string, repName: string) => {
    const newMappings = [...betaMappings];
    const index = newMappings.findIndex(m => m.betaSubgroup === betaName);
    
    if (index >= 0) {
      if (repName === "") {
        // Remove mapping if deselected
        newMappings.splice(index, 1);
      } else {
        newMappings[index] = { ...newMappings[index], assignedRepName: repName };
      }
    } else if (repName !== "") {
      newMappings.push({ betaSubgroup: betaName, assignedRepName: repName });
    }
    
    setBetaMappings(newMappings);
  };

  const unassignedCount = betaSubgroups.filter(b => !betaMappings.find(m => m.betaSubgroup === b)).length;

  return (
    <div className="space-y-6 animate-fade-in text-gray-800">
      
      <div className="bg-pink-50 border border-pink-100 p-4 rounded-xl flex items-start gap-4 shadow-sm">
         <div className="bg-white p-2 rounded-full shadow-sm text-pink-500">
            <Share2 size={24} />
         </div>
         <div className="flex-1">
            <h3 className="font-bold text-lg text-pink-900">تخصیص مشتریان گروه بتا</h3>
            <p className="text-sm text-pink-800 mt-1 leading-relaxed">
               سیستم به صورت خودکار نام کارشناسان بتا را از داخل پرانتز (مثلا: مشتری امیررضا آجرلو) استخراج کرده است.
               <br/>
               لطفاً مشخص کنید این اسامی استخراج شده به کدام کارشناس فروش اصلی تعلق دارند.
            </p>
         </div>
         <div className="text-center bg-white px-4 py-2 rounded-lg border border-pink-100 shadow-sm">
             <div className="text-2xl font-black text-pink-600">{betaSubgroups.length}</div>
             <div className="text-xs text-gray-500">گروه شناسایی شده</div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
         <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h4 className="font-bold text-gray-700">لیست گروه‌های بتا (استخراج شده)</h4>
            {unassignedCount > 0 ? (
               <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                  <AlertCircle size={14} />
                  {unassignedCount} مورد تعیین تکلیف نشده
               </span>
            ) : (
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  تکمیل شد
               </span>
            )}
         </div>
         
         {betaSubgroups.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
               هیچ رکورد "بتا" در فایل آپلود شده یافت نشد. می‌توانید به مرحله بعد بروید.
            </div>
         ) : (
             <table className="w-full text-right text-sm">
               <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                     <th className="p-4 w-1/2">نام استخراج شده (از داخل پرانتز)</th>
                     <th className="p-4 w-12 text-center text-gray-300"><ArrowLeft size={16} /></th>
                     <th className="p-4 w-1/2">تخصیص به کارشناس فروش اصلی</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {betaSubgroups.map((betaName, idx) => {
                     const mapping = betaMappings.find(m => m.betaSubgroup === betaName);
                     const assignedValue = mapping ? mapping.assignedRepName : "";
                     
                     return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                           <td className="p-4 font-bold text-gray-800 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                              {betaName}
                           </td>
                           <td className="p-4 text-center">
                              <ArrowLeft size={16} className="text-gray-300 inline-block" />
                           </td>
                           <td className="p-4">
                              <select
                                 className={`w-full max-w-sm border rounded-lg px-3 py-2 outline-none transition-all cursor-pointer
                                    ${assignedValue 
                                       ? 'border-green-300 bg-green-50 text-green-800 font-bold' 
                                       : 'border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                    }
                                 `}
                                 value={assignedValue}
                                 onChange={(e) => handleMappingChange(betaName, e.target.value)}
                              >
                                 <option value="">-- انتخاب کارشناس --</option>
                                 {realReps.map(rep => (
                                    <option key={rep} value={rep}>{rep}</option>
                                 ))}
                              </select>
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         )}
      </div>
    </div>
  );
};

export default BetaManager;
