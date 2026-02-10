
import React, { useState } from 'react';
import { CommissionProfile, Manager, RepSettings, SalesCategory, CommissionTier } from '../types';
import { Plus, Trash2, UserPlus, Users, Table, Layers, DollarSign, Percent } from 'lucide-react';

interface CommissionSetupProps {
  profiles: CommissionProfile[];
  managers: Manager[];
  repSettings: RepSettings[];
  allReps: string[];
  setProfiles: (p: CommissionProfile[]) => void;
  setManagers: (m: Manager[]) => void;
  setRepSettings: (r: RepSettings[]) => void;
}

const CommissionSetup: React.FC<CommissionSetupProps> = ({
  profiles, managers, repSettings, allReps, setProfiles, setManagers, setRepSettings
}) => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'hierarchy'>('profiles');

  // --- Profile Logic ---
  const addProfile = () => {
    const newProfile: CommissionProfile = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'پروفایل جدید',
      rules: [
        { category: SalesCategory.TARGET, tiers: [{ min: 0, max: 100000000000, value: 0, type: 'percent' }] },
        { category: SalesCategory.BETA, tiers: [{ min: 0, max: 100000000000, value: 0, type: 'percent' }] },
        { category: SalesCategory.OTHER, tiers: [{ min: 0, max: 100000000000, value: 0, type: 'percent' }] },
        { category: SalesCategory.TOTAL, tiers: [{ min: 0, max: 100000000000, value: 0, type: 'percent' }] },
      ]
    };
    setProfiles([...profiles, newProfile]);
  };

  const updateProfileName = (id: string, name: string) => {
    setProfiles(profiles.map(p => p.id === id ? { ...p, name } : p));
  };

  const updateTier = (profileId: string, category: SalesCategory, tierIndex: number, field: keyof CommissionTier, value: any) => {
    setProfiles(profiles.map(p => {
      if (p.id !== profileId) return p;
      // If rule doesn't exist, we must add it first (rare case if existing data lacks new enum)
      const existingRule = p.rules.find(r => r.category === category);
      if (!existingRule) {
         return {
            ...p,
            rules: [...p.rules, {
               category,
               tiers: [{ min: 0, max: 0, value: 0, type: 'percent' }] // Initialize with one empty tier
            }]
         };
      }

      const newRules = p.rules.map(r => {
        if (r.category !== category) return r;
        const newTiers = [...r.tiers];
        newTiers[tierIndex] = { ...newTiers[tierIndex], [field]: value };
        return { ...r, tiers: newTiers };
      });
      return { ...p, rules: newRules };
    }));
  };

  const addTier = (profileId: string, category: SalesCategory) => {
    setProfiles(profiles.map(p => {
      if (p.id !== profileId) return p;
      
      const existingRule = p.rules.find(r => r.category === category);
      // Handle missing rule case
      if (!existingRule) {
         return {
            ...p,
            rules: [...p.rules, {
               category,
               tiers: [{ min: 0, max: 100000000, value: 0, type: 'percent' }] 
            }]
         };
      }

      const newRules = p.rules.map(r => {
        if (r.category !== category) return r;
        const lastMax = r.tiers.length > 0 ? r.tiers[r.tiers.length - 1].max : 0;
        return { ...r, tiers: [...r.tiers, { min: lastMax + 1, max: lastMax * 10, value: 0, type: 'percent' as const }] };
      });
      return { ...p, rules: newRules };
    }));
  };

  const removeTier = (profileId: string, category: SalesCategory, index: number) => {
    setProfiles(profiles.map(p => {
      if (p.id !== profileId) return p;
      const newRules = p.rules.map(r => {
        if (r.category !== category) return r;
        return { ...r, tiers: r.tiers.filter((_, i) => i !== index) };
      });
      return { ...p, rules: newRules };
    }));
  };

  const getCategoryLabel = (cat: SalesCategory) => {
     switch(cat) {
        case SalesCategory.TARGET: return 'تارگت (Target)';
        case SalesCategory.BETA: return 'بتا (Beta)';
        case SalesCategory.OTHER: return 'سایر (Other)';
        case SalesCategory.TOTAL: return 'مجموع کل فروش (Total)';
        default: return cat;
     }
  };

  const getCategoryColor = (cat: SalesCategory) => {
    switch(cat) {
       case SalesCategory.TARGET: return 'bg-blue-100 text-blue-800';
       case SalesCategory.BETA: return 'bg-pink-100 text-pink-800';
       case SalesCategory.OTHER: return 'bg-teal-100 text-teal-800';
       case SalesCategory.TOTAL: return 'bg-indigo-100 text-indigo-800';
       default: return 'bg-gray-100 text-gray-800';
    }
 };

  // Define the order of categories to display
  const categoryOrder = [SalesCategory.TARGET, SalesCategory.BETA, SalesCategory.OTHER, SalesCategory.TOTAL];

  // --- Hierarchy Logic ---
  const addManager = () => {
    setManagers([...managers, {
      id: Math.random().toString(36).substr(2, 9),
      name: 'مدیر جدید',
      subordinates: [],
      profileId: ''
    }]);
  };

  const toggleSubordinate = (managerId: string, repName: string) => {
    setManagers(managers.map(m => {
      if (m.id !== managerId) {
        if (m.subordinates.includes(repName)) {
           return { ...m, subordinates: m.subordinates.filter(r => r !== repName) };
        }
        return m;
      }
      const exists = m.subordinates.includes(repName);
      return { 
        ...m, 
        subordinates: exists ? m.subordinates.filter(r => r !== repName) : [...m.subordinates, repName] 
      };
    }));
  };

  const setRepProfile = (repName: string, profileId: string) => {
    const existing = repSettings.find(r => r.name === repName);
    if (existing) {
      setRepSettings(repSettings.map(r => r.name === repName ? { ...r, profileId } : r));
    } else {
      setRepSettings([...repSettings, { name: repName, profileId }]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('profiles')} 
          className={`pb-3 px-6 font-bold flex items-center gap-2 transition-colors ${activeTab === 'profiles' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Table size={18} />
          ۱. جداول و بازه‌های پورسانت
        </button>
        <button 
          onClick={() => setActiveTab('hierarchy')} 
          className={`pb-3 px-6 font-bold flex items-center gap-2 transition-colors ${activeTab === 'hierarchy' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Layers size={18} />
          ۲. ساختار سازمانی (مدیران و کارشناسان)
        </button>
      </div>

      {activeTab === 'profiles' && (
        <div className="space-y-8">
           <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
             <div>
                <h3 className="font-bold text-blue-900">تعریف پروفایل‌های پورسانت</h3>
                <p className="text-sm text-blue-700 mt-1">
                  برای هر سمت (مدیر فروش، کارشناس تهران، سوپروایزر و...) یک پروفایل با بازه‌های فروش متفاوت ایجاد کنید.
                </p>
             </div>
             <button onClick={addProfile} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition">
                <Plus size={16} /> پروفایل جدید
             </button>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {profiles.map(profile => (
              <div key={profile.id} className="bg-white border-2 border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50/50 px-6 py-4 flex justify-between items-center border-b border-gray-100">
                   <div className="flex items-center gap-2 w-full max-w-md">
                     <span className="text-gray-400 font-bold text-sm whitespace-nowrap">نام پروفایل:</span>
                     <input 
                        value={profile.name} 
                        onChange={(e) => updateProfileName(profile.id, e.target.value)}
                        className="bg-white border border-gray-300 rounded px-3 py-1 font-bold text-gray-900 focus:border-blue-500 focus:outline-none w-full"
                        placeholder="مثلا: کارشناس فروش تهران"
                     />
                   </div>
                   <button onClick={() => setProfiles(profiles.filter(p => p.id !== profile.id))} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition">
                      <Trash2 size={18} />
                   </button>
                </div>
                
                <div className="p-6 grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-6">
                   {categoryOrder.map(cat => {
                     // Find existing rule or use empty fallback for rendering safety
                     const rule = profile.rules.find(r => r.category === cat) || { category: cat, tiers: [] };
                     
                     return (
                     <div key={cat} className={`border border-gray-200 rounded-xl p-4 ${cat === SalesCategory.TOTAL ? 'bg-indigo-50/40 border-indigo-100 ring-1 ring-indigo-50' : 'bg-gray-50/30'}`}>
                        <div className="flex justify-between items-center mb-4">
                           <span className={`font-bold px-3 py-1 rounded text-xs ${getCategoryColor(cat)}`}>
                              {getCategoryLabel(cat)}
                           </span>
                           <button onClick={() => addTier(profile.id, cat)} className="text-xs text-blue-600 hover:underline font-medium">+ افزودن پله</button>
                        </div>
                        <div className="space-y-2">
                           {rule.tiers.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-4">بدون قانون محاسبه</p>
                           ) : (
                              <>
                                 <div className="flex text-[10px] text-gray-400 font-bold px-1 mb-1 items-center">
                                    <span className="w-28 text-center">از مبلغ (ریال)</span>
                                    <span className="w-4"></span>
                                    <span className="w-28 text-center">تا مبلغ (ریال)</span>
                                    <span className="w-4"></span>
                                    <span className="w-16 text-center">نوع</span>
                                    <span className="w-2"></span>
                                    <span className="w-20 text-center">مقدار</span>
                                 </div>
                                 {rule.tiers.map((tier, idx) => (
                                    <div key={idx} className="flex items-center gap-1 text-xs">
                                       <input 
                                       type="number" 
                                       value={tier.min}
                                       onChange={(e) => updateTier(profile.id, cat, idx, 'min', Number(e.target.value))}
                                       className="w-28 p-1.5 border border-gray-300 bg-white text-gray-900 rounded text-center focus:border-blue-500 outline-none"
                                       />
                                       <span className="text-gray-300">-</span>
                                       <input 
                                       type="number" 
                                       value={tier.max}
                                       onChange={(e) => updateTier(profile.id, cat, idx, 'max', Number(e.target.value))}
                                       className="w-28 p-1.5 border border-gray-300 bg-white text-gray-900 rounded text-center focus:border-blue-500 outline-none"
                                       />
                                       
                                       <span className="w-2"></span>
                                       
                                       <div className="flex bg-white border border-gray-300 rounded overflow-hidden">
                                          <button 
                                          onClick={() => updateTier(profile.id, cat, idx, 'type', 'percent')}
                                          className={`px-1.5 py-1 ${tier.type === 'percent' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-50'}`}
                                          title="درصد"
                                          >
                                          <Percent size={12} />
                                          </button>
                                          <div className="w-[1px] bg-gray-200"></div>
                                          <button 
                                          onClick={() => updateTier(profile.id, cat, idx, 'type', 'fixed')}
                                          className={`px-1.5 py-1 ${tier.type === 'fixed' ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:bg-gray-50'}`}
                                          title="مبلغ ثابت"
                                          >
                                          <DollarSign size={12} />
                                          </button>
                                       </div>

                                       <span className="text-gray-300">=</span>
                                       
                                       <input 
                                       type="number" 
                                       value={tier.value}
                                       onChange={(e) => updateTier(profile.id, cat, idx, 'value', Number(e.target.value))}
                                       className={`w-20 p-1.5 border rounded text-center font-bold focus:border-blue-500 outline-none
                                          ${tier.type === 'percent' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-green-200 bg-green-50 text-green-700'}
                                       `}
                                       placeholder={tier.type === 'percent' ? '0.5' : '1000000'}
                                       />
                                       
                                       <button onClick={() => removeTier(profile.id, cat, idx)} className="text-gray-300 hover:text-red-500 px-1">
                                          <Trash2 size={12} />
                                       </button>
                                    </div>
                                 ))}
                              </>
                           )}
                        </div>
                     </div>
                   )})}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'hierarchy' && (
        <div className="space-y-8">
           {/* Section 1: Managers */}
           <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="font-bold text-lg text-gray-800">تعریف مدیران فروش</h3>
                    <p className="text-sm text-gray-500">مدیرانی که در فایل اکسل نیستند اما بر اساس فروش تیم پورسانت می‌گیرند.</p>
                 </div>
                 <button onClick={addManager} className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-purple-700 transition">
                    <UserPlus size={16} /> افزودن مدیر
                 </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {managers.map(mgr => (
                    <div key={mgr.id} className="border border-purple-100 bg-purple-50/50 rounded-xl p-5 shadow-sm">
                       <div className="flex gap-2 mb-4">
                          <input 
                            value={mgr.name} 
                            onChange={(e) => setManagers(managers.map(m => m.id === mgr.id ? {...m, name: e.target.value} : m))}
                            className="font-bold bg-white border border-gray-200 rounded px-3 py-2 flex-1 text-sm focus:border-purple-500 outline-none"
                            placeholder="نام و نام خانوادگی مدیر"
                          />
                          <select 
                             value={mgr.profileId}
                             onChange={(e) => setManagers(managers.map(m => m.id === mgr.id ? {...m, profileId: e.target.value} : m))}
                             className="text-xs border border-gray-200 rounded px-2 bg-white text-gray-900 outline-none focus:border-purple-500"
                          >
                             <option value="">انتخاب جدول پورسانت...</option>
                             {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <button onClick={() => setManagers(managers.filter(m => m.id !== mgr.id))} className="text-red-300 hover:text-red-500 px-1">
                             <Trash2 size={16} />
                          </button>
                       </div>
                       
                       <div className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                          <Users size={12}/>
                          انتخاب اعضای تیم (زیرمجموعه):
                       </div>
                       <div className="max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {allReps.length === 0 && <p className="text-gray-400 text-xs text-center col-span-2 py-4">ابتدا فایل فروش را آپلود کنید تا لیست کارشناسان اینجا نمایش داده شود.</p>}
                          {allReps.map(rep => (
                             <label key={rep} className={`flex items-center gap-2 cursor-pointer p-2 rounded text-xs transition-colors border ${mgr.subordinates.includes(rep) ? 'bg-purple-50 border-purple-200' : 'border-transparent hover:bg-gray-50'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={mgr.subordinates.includes(rep)} 
                                  onChange={() => toggleSubordinate(mgr.id, rep)}
                                  className="rounded text-purple-600 focus:ring-purple-500"
                                />
                                <span className="truncate" title={rep}>{rep}</span>
                             </label>
                          ))}
                       </div>
                    </div>
                 ))}
                 {managers.length === 0 && <p className="text-gray-400 text-sm text-center col-span-2 py-8 bg-gray-50 rounded border border-dashed">هنوز مدیری تعریف نشده است.</p>}
              </div>
           </div>

           {/* Section 2: Rep Assignment */}
           <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-lg text-gray-800 mb-4">تخصیص جدول پورسانت به کارشناسان</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                 <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                       <tr>
                          <th className="p-3">نام کارشناس (از فایل اکسل)</th>
                          <th className="p-3">جدول پورسانت (پروفایل)</th>
                          <th className="p-3">مدیر مستقیم</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {allReps.length === 0 && (
                          <tr><td colSpan={3} className="p-6 text-center text-gray-400">اطلاعاتی یافت نشد. لطفا فایل فروش را بارگذاری کنید.</td></tr>
                       )}
                       {allReps.map(rep => {
                          const setting = repSettings.find(r => r.name === rep);
                          const manager = managers.find(m => m.subordinates.includes(rep));
                          return (
                             <tr key={rep} className="hover:bg-gray-50">
                                <td className="p-3 font-medium text-gray-800">{rep}</td>
                                <td className="p-3">
                                   <select 
                                      value={setting?.profileId || ''} 
                                      onChange={(e) => setRepProfile(rep, e.target.value)}
                                      className="bg-white text-gray-900 border border-gray-300 rounded px-2 py-1.5 w-full max-w-xs text-sm outline-none focus:border-blue-500"
                                   >
                                      <option value="">-- بدون پورسانت --</option>
                                      {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                   </select>
                                </td>
                                <td className="p-3">
                                   {manager ? (
                                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold border border-purple-200 inline-flex items-center gap-1">
                                         <UserPlus size={10} />
                                         {manager.name}
                                      </span>
                                   ) : <span className="text-gray-300 text-xs">-</span>}
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CommissionSetup;
