import React, { useState } from 'react';
import { ExpenseRow, SalesCategory, ManualDeduction } from '../types';
import { Plus, Trash2, AlertCircle, Link, User, HelpCircle, CheckCircle2 } from 'lucide-react';

interface ExpenseManagerProps {
  expenses: ExpenseRow[];
  manualDeductions: ManualDeduction[];
  onUpdateExpense: (index: number, category: SalesCategory) => void;
  onAddManual: (deduction: ManualDeduction) => void;
  onRemoveManual: (id: string) => void;
  reps: string[];
}

const ExpenseManager: React.FC<ExpenseManagerProps> = ({ 
  expenses, 
  manualDeductions, 
  onUpdateExpense, 
  onAddManual, 
  onRemoveManual,
  reps 
}) => {
  const [newDed, setNewDed] = useState<Partial<ManualDeduction>>({
    category: SalesCategory.OTHER,
    amount: 0,
    description: ''
  });

  const handleAdd = () => {
    if (newDed.repName && newDed.amount && !isNaN(newDed.amount) && newDed.category) {
      onAddManual({
        id: Math.random().toString(36).substr(2, 9),
        repName: newDed.repName,
        amount: Number(newDed.amount),
        category: newDed.category,
        description: newDed.description || 'کسورات دستی'
      });
      setNewDed({ ...newDed, amount: 0, description: '' });
    }
  };

  const pendingExpenses = expenses.filter(e => !e.assignedCategory).length;

  return (
    <div className="space-y-8 text-gray-800">
      
      {/* 1. Mapped Expenses from Excel */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Link size={18} />
              تخصیص هزینه های سیستمی (تخفیفات مازاد)
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              تنها مواردی که نام مجری آنها به یک کارشناس لینک شده است نمایش داده می‌شوند. موارد غیرمرتبط حذف شده‌اند.
            </p>
          </div>
          {pendingExpenses > 0 ? (
            <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
              <AlertCircle size={14} />
              {pendingExpenses} مورد نیاز به تعیین دسته بندی
            </div>
          ) : (
             expenses.length > 0 && (
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  همه موارد تعیین وضعیت شدند
                </div>
             )
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 z-10 shadow-sm">
              <tr>
                <th className="p-3 font-semibold text-gray-700">خریدار (مجری هزینه)</th>
                <th className="p-3 font-semibold text-gray-700 bg-blue-50">کارشناس لینک شده</th>
                <th className="p-3 font-semibold text-gray-700">مبلغ (تخفیف)</th>
                <th className="p-3 font-semibold text-gray-700">شرح</th>
                <th className="p-3 font-semibold text-gray-700 w-48">کسر از (الزامی)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((exp, idx) => {
                const isAssigned = !!exp.assignedCategory;
                
                return (
                <tr key={idx} className={`${!isAssigned ? 'bg-orange-50/50' : 'bg-white'} hover:bg-gray-50 transition-colors`}>
                  <td className="p-3 text-gray-900 font-medium">{exp.executorName}</td>
                  
                  <td className="p-3 font-bold border-l border-r border-gray-100 text-blue-700">
                    <div className="flex items-center gap-2">
                       <User size={14} className="opacity-50"/>
                       {exp.linkedRep}
                    </div>
                  </td>

                  <td className="p-3 font-mono text-red-600 font-bold">{(exp.amount).toLocaleString()}</td>
                  <td className="p-3 text-gray-500 truncate max-w-xs" title={exp.description}>{exp.description}</td>
                  <td className="p-3">
                    <select 
                      className={`border rounded px-2 py-1.5 text-sm w-full transition-all cursor-pointer
                        ${!isAssigned 
                           ? 'border-orange-300 bg-white ring-2 ring-orange-100 text-gray-900 focus:border-orange-500' 
                           : 'border-green-300 bg-green-50 text-green-800'
                        }
                      `}
                      value={exp.assignedCategory || ''}
                      onChange={(e) => onUpdateExpense(idx, e.target.value as SalesCategory)}
                    >
                      <option value="" disabled>انتخاب کنید...</option>
                      <option value={SalesCategory.TARGET}>تارگت</option>
                      <option value={SalesCategory.BETA}>بتا</option>
                      <option value={SalesCategory.OTHER}>سایر</option>
                    </select>
                    {!isAssigned && <span className="text-[10px] text-orange-600 block mt-1 font-bold">انتخاب الزامی*</span>}
                  </td>
                </tr>
              )})}
              {expenses.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-8 text-center bg-gray-50">
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                             <HelpCircle size={32} className="text-gray-300"/>
                             <p className="font-bold text-gray-600">هیچ رکورد لینک شده‌ای یافت نشد</p>
                             <div className="text-xs text-right max-w-md bg-white p-4 rounded border border-gray-200 mt-2">
                                <p className="mb-2">دلایل احتمالی:</p>
                                <ul className="list-disc list-inside space-y-1 text-gray-500">
                                    <li>نام مجری در فایل هزینه با نام خریدار در فایل فروش یکسان نیست.</li>
                                    <li>فایل هزینه دارای رکوردهای نامعتبر است.</li>
                                    <li>هنوز فایل فروش به اشخاص آپلود نشده است.</li>
                                </ul>
                             </div>
                        </div>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Manual Deductions */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-2">
          کسورات دستی
          <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">ثبت موارد خاص</span>
        </h3>
        
        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-200">
          <div className="col-span-1">
            <label className="block text-sm font-bold text-gray-700 mb-2">کارشناس</label>
            <div className="relative">
              <select 
                className="w-full h-12 border border-gray-300 rounded-xl px-3 text-base text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm"
                value={newDed.repName || ''}
                onChange={e => setNewDed({...newDed, repName: e.target.value})}
              >
                <option value="">انتخاب...</option>
                {reps.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          
          <div className="col-span-1">
            <label className="block text-sm font-bold text-gray-700 mb-2">مبلغ (ریال)</label>
            <input 
              type="number" 
              className="w-full h-12 border border-gray-300 rounded-xl px-4 text-base text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm font-mono"
              value={newDed.amount || ''}
              onChange={e => setNewDed({...newDed, amount: Number(e.target.value)})}
              placeholder="0"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-bold text-gray-700 mb-2">دسته بندی</label>
            <select 
               className="w-full h-12 border border-gray-300 rounded-xl px-3 text-base text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm"
               value={newDed.category}
               onChange={e => setNewDed({...newDed, category: e.target.value as SalesCategory})}
            >
              <option value={SalesCategory.TARGET}>تارگت</option>
              <option value={SalesCategory.BETA}>بتا</option>
              <option value={SalesCategory.OTHER}>سایر</option>
            </select>
          </div>

          <div className="col-span-1 md:col-span-1.5">
            <label className="block text-sm font-bold text-gray-700 mb-2">شرح</label>
            <input 
              type="text" 
              className="w-full h-12 border border-gray-300 rounded-xl px-4 text-base text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm"
              placeholder="مثلا جریمه تاخیر"
              value={newDed.description}
              onChange={e => setNewDed({...newDed, description: e.target.value})}
            />
          </div>

          <div className="col-span-1 md:col-span-0.5">
            <button 
              onClick={handleAdd}
              disabled={!newDed.repName || !newDed.amount}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed flex justify-center items-center transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
           <table className="w-full text-right text-sm">
             <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
               <tr>
                 <th className="p-4 font-bold">کارشناس</th>
                 <th className="p-4 font-bold">مبلغ</th>
                 <th className="p-4 font-bold">دسته</th>
                 <th className="p-4 font-bold">شرح</th>
                 <th className="p-4 text-center font-bold">عملیات</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100 bg-white">
               {manualDeductions.map(m => (
                 <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                   <td className="p-4 text-gray-900 font-medium">{m.repName}</td>
                   <td className="p-4 text-red-600 font-mono font-bold text-base">-{m.amount.toLocaleString()}</td>
                   <td className="p-4">
                     <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                        m.category === SalesCategory.TARGET ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                        m.category === SalesCategory.BETA ? 'bg-pink-50 text-pink-700 border-pink-200' : 
                        'bg-teal-50 text-teal-700 border-teal-200'
                      }`}>
                       {m.category}
                     </span>
                   </td>
                   <td className="p-4 text-gray-600">{m.description}</td>
                   <td className="p-4 text-center">
                     <button onClick={() => onRemoveManual(m.id)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-all">
                       <Trash2 size={18} />
                     </button>
                   </td>
                 </tr>
               ))}
               {manualDeductions.length === 0 && (
                 <tr><td colSpan={5} className="p-8 text-center text-gray-400">هنوز موردی ثبت نشده است</td></tr>
               )}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

export default ExpenseManager;