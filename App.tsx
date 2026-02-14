
import React, { useState, useMemo, useEffect } from 'react';
import { AppState, SalesCategory, ExpenseRow, ManualDeduction, FullReportSnapshot } from './types';
import { DEFAULT_COMMISSION_PROFILES } from './constants';
import { parsePersonSales, parseGoodsSales, parseExpenses } from './services/csvParser';
import { aggregateData, linkExpensesToReps, calculateManagerCommissions, extractBetaRepName } from './services/calculationService';
import { loadConfiguration, saveConfiguration, saveReport, fetchReportsList, fetchReportDetail } from './services/dataService';
import FileUpload from './components/FileUpload';
import ExpenseManager from './components/ExpenseManager';
import Dashboard from './components/Dashboard';
import CommissionSetup from './components/CommissionSetup';
import BetaManager from './components/BetaManager';
import HistoryView from './components/HistoryView';
import { Calculator, LayoutDashboard, Settings, FileSpreadsheet, Percent, ChevronLeft, ChevronRight, AlertCircle, AlertTriangle, Save, Database, Share2, FileClock } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentView: 'process',
    processStep: 1,
    personSales: [],
    goodsSales: [],
    expenses: [],
    manualDeductions: [],
    commissionProfiles: DEFAULT_COMMISSION_PROFILES,
    managers: [],
    repSettings: [],
    betaMappings: [],
    savedReports: []
  });

  const [isSaving, setIsSaving] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load Data on Mount
  useEffect(() => {
    const initData = async () => {
      const { profiles, managers, repSettings, betaMappings } = await loadConfiguration();
      const reports = await fetchReportsList();
      
      setState(prev => ({
        ...prev,
        commissionProfiles: profiles || DEFAULT_COMMISSION_PROFILES,
        managers: managers || [],
        repSettings: repSettings || [],
        betaMappings: betaMappings || [],
        savedReports: reports || []
      }));
      setDataLoaded(true);
    };
    initData();
  }, []);

  // Re-run linking logic
  useEffect(() => {
    if (state.personSales.length > 0 && state.expenses.length > 0) {
      const linkedExpenses = linkExpensesToReps(state.expenses, state.personSales);
      const hasChanges = linkedExpenses.some((exp, idx) => exp.linkedRep !== state.expenses[idx]?.linkedRep);
      if (hasChanges) {
         setState(s => ({ ...s, expenses: linkedExpenses }));
      }
    }
  }, [state.personSales, state.expenses.length]); 

  // --- Handlers ---
  const handleSaveConfig = async () => {
    setIsSaving(true);
    const success = await saveConfiguration(
       state.commissionProfiles, 
       state.managers, 
       state.repSettings,
       state.betaMappings
    );
    setIsSaving(false);
    if(success) {
      alert('تنظیمات با موفقیت در پایگاه داده ذخیره شد.');
    }
  };
  
  const handleSaveReport = async (year: number, month: number): Promise<boolean> => {
     const snapshot: FullReportSnapshot = {
        personSales: state.personSales,
        goodsSales: state.goodsSales,
        expenses: state.expenses,
        manualDeductions: state.manualDeductions,
        betaMappings: state.betaMappings,
        profiles: state.commissionProfiles,
        managers: state.managers,
        repSettings: state.repSettings
     };

     const success = await saveReport(year, month, snapshot);
     if (success) {
        const reports = await fetchReportsList();
        setState(s => ({ ...s, savedReports: reports }));
     }
     return success;
  };

  const handleLoadReport = async (reportId: number) => {
     const snapshot = await fetchReportDetail(reportId);
     if (snapshot) {
        setState(s => ({
           ...s,
           personSales: snapshot.personSales,
           goodsSales: snapshot.goodsSales,
           expenses: snapshot.expenses,
           manualDeductions: snapshot.manualDeductions,
           betaMappings: snapshot.betaMappings,
           commissionProfiles: snapshot.profiles || s.commissionProfiles,
           managers: snapshot.managers || s.managers,
           repSettings: snapshot.repSettings || s.repSettings,
           // Switch view to Dashboard immediately
           currentView: 'process',
           processStep: 4 
        }));
     }
  };

  const handleParsePersonSales = (buffer: ArrayBuffer) => {
    const data = parsePersonSales(buffer);
    setState(s => {
      const linked = s.expenses.length > 0 ? linkExpensesToReps(s.expenses, data) : s.expenses;
      return { ...s, personSales: data, expenses: linked };
    });
  };

  const handleParseGoodsSales = (buffer: ArrayBuffer) => {
    setState(s => ({ ...s, goodsSales: parseGoodsSales(buffer) }));
  };

  const handleParseExpenses = (buffer: ArrayBuffer) => {
    const rawExpenses = parseExpenses(buffer);
    setState(s => {
      const linked = s.personSales.length > 0 ? linkExpensesToReps(rawExpenses, s.personSales) : rawExpenses;
      return { ...s, expenses: linked };
    });
  };

  const updateExpenseCategory = (index: number, cat: SalesCategory) => {
    const newExpenses = [...state.expenses];
    newExpenses[index] = { ...newExpenses[index], assignedCategory: cat };
    setState(s => ({ ...s, expenses: newExpenses }));
  };

  const addManualDeduction = (ded: ManualDeduction) => {
    setState(s => ({ ...s, manualDeductions: [...s.manualDeductions, ded] }));
  };

  const removeManualDeduction = (id: string) => {
    setState(s => ({ ...s, manualDeductions: s.manualDeductions.filter(d => d.id !== id) }));
  };

  // --- Derived Data ---
  const allReps = useMemo(() => {
    const set = new Set<string>();
    state.personSales.forEach(p => { 
        // Only consider it a "Rep" if it's NOT a beta group, or if it is mapped to someone
        if(!p.isBeta && p.subgroup) set.add(p.subgroup);
    });
    return Array.from(set);
  }, [state.personSales]);

  // Main Aggregation
  const aggregatedData = useMemo(() => {
    return aggregateData(
      state.personSales,
      state.goodsSales,
      state.expenses,
      state.manualDeductions,
      state.commissionProfiles,
      state.repSettings,
      state.betaMappings
    );
  }, [state.personSales, state.goodsSales, state.expenses, state.manualDeductions, state.commissionProfiles, state.repSettings, state.betaMappings]);

  // Manager Aggregation
  const managersData = useMemo(() => {
    return calculateManagerCommissions(aggregatedData, state.managers, state.commissionProfiles);
  }, [aggregatedData, state.managers, state.commissionProfiles]);

  // Logic for Monthly Process Navigation
  const unassignedExpensesCount = state.expenses.filter(e => !e.assignedCategory).length;
  
  // Calculate unassigned Beta groups
  const unassignedBetaCount = useMemo(() => {
     // Get unique EXTRACTED names instead of raw subgroups
     const betaGroups = new Set(
        state.personSales
           .filter(p => p.isBeta && p.subgroup)
           .map(p => extractBetaRepName(p.subgroup))
     );
     
     let count = 0;
     betaGroups.forEach(bg => {
        if (!state.betaMappings.find(m => m.betaSubgroup === bg)) count++;
     });
     return count;
  }, [state.personSales, state.betaMappings]);

  const canGoNext = () => {
    if (state.processStep === 1) return state.personSales.length > 0 && state.goodsSales.length > 0;
    // Step 2 is Beta Mapping - we allow them to proceed even if unassigned, but show warning
    if (state.processStep === 3) return unassignedExpensesCount === 0;
    return true;
  };

  // --- Render ---
  return (
    <div className="flex min-h-screen bg-gray-50 print:bg-white print:block">
      
      {/* Sidebar - HIDDEN ON PRINT */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col shadow-2xl z-50 print:hidden">
         <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="bg-blue-600 p-2 rounded shadow-lg shadow-blue-900">
               <Calculator size={20} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">محاسبه پورسانت</h1>
         </div>
         
         <nav className="flex-1 p-4 space-y-2">
            <button 
               onClick={() => setState(s => ({...s, currentView: 'process'}))}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${state.currentView === 'process' ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
               <FileSpreadsheet size={20} />
               فرآیند محاسبه ماهانه
            </button>
            
            <button 
               onClick={() => setState(s => ({...s, currentView: 'history'}))}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${state.currentView === 'history' ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
               <FileClock size={20} />
               سابقه گزارشات
            </button>
            
            <button 
               onClick={() => setState(s => ({...s, currentView: 'settings'}))}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${state.currentView === 'settings' ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
               <Settings size={20} />
               تنظیمات پایه و پورسانت
            </button>
         </nav>
         
         <div className="p-4 border-t border-slate-800">
             <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 flex items-center gap-2">
                <Database size={14} className={dataLoaded ? 'text-green-400' : 'text-yellow-400'} />
                {dataLoaded ? 'پایگاه داده متصل است' : 'در حال اتصال...'}
             </div>
         </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto flex flex-col print:overflow-visible">
         
         {/* -- VIEW 1: Monthly Process (Wizard) -- */}
         {state.currentView === 'process' && (
            <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-8 py-8 print:p-0 print:max-w-none">
               {/* Process Header/Stepper - HIDDEN ON PRINT */}
               <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:hidden">
                  <h2 className="text-xl font-bold text-gray-800">محاسبه حقوق و دستمزد</h2>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                     <span className={`px-3 py-1 rounded-full transition-colors ${state.processStep === 1 ? 'bg-blue-100 text-blue-700 font-bold' : ''}`}>۱. آپلود</span>
                     <ChevronLeft size={14} />
                     <span className={`px-3 py-1 rounded-full transition-colors ${state.processStep === 2 ? 'bg-blue-100 text-blue-700 font-bold' : ''}`}>۲. تخصیص بتا</span>
                     <ChevronLeft size={14} />
                     <span className={`px-3 py-1 rounded-full transition-colors ${state.processStep === 3 ? 'bg-blue-100 text-blue-700 font-bold' : ''}`}>۳. کسورات</span>
                     <ChevronLeft size={14} />
                     <span className={`px-3 py-1 rounded-full transition-colors ${state.processStep === 4 ? 'bg-blue-100 text-blue-700 font-bold' : ''}`}>۴. داشبورد</span>
                  </div>
               </div>

               {/* Step Content */}
               <div className="flex-1">
                  {state.processStep === 1 && (
                     <div className="space-y-6 animate-fade-in-up">
                        <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg flex items-start gap-3 text-sm text-yellow-800">
                           <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                           <p>لطفاً فایل‌های اکسل مربوط به ماه جاری را بارگذاری کنید. اطلاعات قبلی با بارگذاری جدید جایگزین می‌شوند.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <FileUpload label="۱. اکسل فروش به اشخاص" description="شامل نام مشتری، زیرگروه" onFileLoaded={handleParsePersonSales} isLoaded={state.personSales.length > 0} />
                           <FileUpload label="۲. اکسل فروش کالا" description="شامل کد کالا (TG) و فروش" onFileLoaded={handleParseGoodsSales} isLoaded={state.goodsSales.length > 0} />
                           <FileUpload label="۳. صورت حساب هزینه" description="هزینه های خریداران" onFileLoaded={handleParseExpenses} isLoaded={state.expenses.length > 0} />
                        </div>
                     </div>
                  )}
                  
                  {state.processStep === 2 && (
                     <div className="space-y-6 animate-fade-in-up">
                         <BetaManager 
                            personSales={state.personSales}
                            betaMappings={state.betaMappings}
                            setBetaMappings={(m) => setState(s => ({...s, betaMappings: m}))}
                         />
                     </div>
                  )}

                  {state.processStep === 3 && (
                     <div className="space-y-6 animate-fade-in-up">
                        <ExpenseManager 
                           expenses={state.expenses}
                           manualDeductions={state.manualDeductions}
                           onUpdateExpense={updateExpenseCategory}
                           onAddManual={addManualDeduction}
                           onRemoveManual={removeManualDeduction}
                           reps={allReps}
                        />
                     </div>
                  )}

                  {state.processStep === 4 && (
                     <div className="space-y-6 animate-fade-in-up">
                        <Dashboard 
                           data={aggregatedData} 
                           managersData={managersData}
                           personSales={state.personSales}
                           goodsSales={state.goodsSales}
                           betaMappings={state.betaMappings} 
                           expenses={state.expenses}
                           onSaveReport={handleSaveReport}
                        />
                     </div>
                  )}
               </div>

               {/* Process Footer Navigation - HIDDEN ON PRINT */}
               <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-center print:hidden">
                  <button 
                     onClick={() => setState(s => ({...s, processStep: Math.max(1, s.processStep - 1)}))}
                     disabled={state.processStep === 1}
                     className="px-6 py-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2 font-medium transition-colors"
                  >
                     <ChevronRight size={16} />
                     مرحله قبل
                  </button>

                  <div className="flex items-center gap-4">
                     {state.processStep === 2 && unassignedBetaCount > 0 && (
                        <div className="text-pink-600 text-sm font-bold flex items-center gap-1 animate-pulse">
                           <Share2 size={16} />
                           <span>{unassignedBetaCount} گروه بتا تخصیص نیافته است</span>
                        </div>
                     )}

                     {state.processStep === 3 && unassignedExpensesCount > 0 && (
                        <div className="text-orange-600 text-sm font-bold flex items-center gap-1 animate-pulse">
                           <AlertCircle size={16} />
                           <span>{unassignedExpensesCount} مورد هزینه تعیین وضعیت نشده است</span>
                        </div>
                     )}
                     
                     <button 
                        onClick={() => setState(s => ({...s, processStep: Math.min(4, s.processStep + 1)}))}
                        disabled={!canGoNext() || state.processStep === 4}
                        className="bg-blue-600 text-white px-8 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-200 font-bold transition-all active:scale-95"
                     >
                        {state.processStep === 4 ? 'پایان' : 'مرحله بعد'}
                        {state.processStep !== 4 && <ChevronLeft size={16} />}
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* -- VIEW 2: Settings -- */}
         {state.currentView === 'settings' && (
            <div className="max-w-7xl mx-auto w-full px-8 py-8 animate-fade-in-up print:hidden">
               <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-bold text-gray-800 border-r-4 border-blue-500 pr-3">تنظیمات پایه سیستم</h2>
                   <button 
                      onClick={handleSaveConfig}
                      disabled={isSaving}
                      className="bg-emerald-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition active:scale-95 disabled:opacity-70 disabled:cursor-wait"
                   >
                      {isSaving ? 'در حال ذخیره...' : 'ذخیره در دیتابیس'}
                      <Save size={18} />
                   </button>
               </div>
               
               <CommissionSetup 
                  profiles={state.commissionProfiles}
                  managers={state.managers}
                  repSettings={state.repSettings}
                  allReps={allReps}
                  setProfiles={(p) => setState(s => ({...s, commissionProfiles: p}))}
                  setManagers={(m) => setState(s => ({...s, managers: m}))}
                  setRepSettings={(r) => setState(s => ({...s, repSettings: r}))}
               />
            </div>
         )}

         {/* -- VIEW 3: History -- */}
         {state.currentView === 'history' && (
            <HistoryView 
               savedReports={state.savedReports} 
               onLoadReport={handleLoadReport}
            />
         )}
      </main>
    </div>
  );
};

export default App;
