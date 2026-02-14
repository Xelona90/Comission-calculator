
import React, { useState } from 'react';
import { SavedReportMetadata } from '../types';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Loader2, FileClock, Download, FileSpreadsheet } from 'lucide-react';
import { fetchReportDetail } from '../services/dataService';
import { exportReportToExcel } from '../services/excelService';

interface HistoryViewProps {
  savedReports: SavedReportMetadata[];
  onLoadReport: (reportId: number) => Promise<void>;
}

const MONTHS = [
  { id: 1, name: 'فروردین' },
  { id: 2, name: 'اردیبهشت' },
  { id: 3, name: 'خرداد' },
  { id: 4, name: 'تیر' },
  { id: 5, name: 'مرداد' },
  { id: 6, name: 'شهریور' },
  { id: 7, name: 'مهر' },
  { id: 8, name: 'آبان' },
  { id: 9, name: 'آذر' },
  { id: 10, name: 'دی' },
  { id: 11, name: 'بهمن' },
  { id: 12, name: 'اسفند' },
];

const HistoryView: React.FC<HistoryViewProps> = ({ savedReports, onLoadReport }) => {
  const [selectedYear, setSelectedYear] = useState<number>(1403);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const getReportForMonth = (monthId: number) => {
    return savedReports.find(r => r.year === selectedYear && r.month === monthId);
  };

  const handleLoad = async (reportId: number) => {
    setLoadingId(reportId);
    await onLoadReport(reportId);
    setLoadingId(null);
  };

  const handleExport = async (e: React.MouseEvent, reportId: number, year: number, month: number) => {
    e.stopPropagation(); // Prevent triggering the card click (Load)
    setExportingId(reportId);
    try {
      const snapshot = await fetchReportDetail(reportId);
      if (snapshot) {
        exportReportToExcel(snapshot, year, month);
      } else {
        alert('خطا در دریافت اطلاعات گزارش.');
      }
    } catch (err) {
      console.error(err);
      alert('خطا در ایجاد فایل اکسل.');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-8 py-8 animate-fade-in-up">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
             <FileClock className="text-purple-600" />
             سابقه گزارشات پورسانت
          </h2>
          <p className="text-gray-500 mt-2 text-sm">
            مشاهده و بازیابی گزارشات ذخیره شده در سیستم بدون نیاز به آپلود مجدد فایل‌ها
          </p>
        </div>

        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
          <button 
             onClick={() => setSelectedYear(y => y - 1)}
             className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
          >
             <ChevronRight size={20} />
          </button>
          <span className="font-black text-xl w-24 text-center text-gray-800">{selectedYear}</span>
          <button 
             onClick={() => setSelectedYear(y => y + 1)}
             className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
          >
             <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {MONTHS.map(month => {
          const report = getReportForMonth(month.id);
          const hasReport = !!report;
          const isLoading = loadingId === report?.id;
          const isExporting = exportingId === report?.id;

          return (
            <div 
              key={month.id}
              onClick={() => hasReport && !isLoading && !isExporting && handleLoad(report.id)}
              className={`
                relative h-44 rounded-2xl border-2 transition-all duration-300 flex flex-col justify-between p-6 cursor-pointer overflow-hidden group
                ${hasReport 
                  ? 'border-purple-200 bg-white hover:border-purple-500 hover:shadow-lg hover:shadow-purple-100' 
                  : 'border-gray-100 bg-gray-50 opacity-60 cursor-default grayscale'
                }
              `}
            >
              {hasReport && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
              )}
              
              <div className="flex justify-between items-start">
                 <span className={`text-xl font-black ${hasReport ? 'text-gray-800' : 'text-gray-400'}`}>
                    {month.name}
                 </span>
                 {hasReport ? (
                    <CheckCircle2 className="text-green-500 drop-shadow-sm" size={24} />
                 ) : (
                    <Calendar className="text-gray-300" size={24} />
                 )}
              </div>

              <div className="mt-2">
                 {isLoading ? (
                    <div className="flex items-center gap-2 text-purple-600 font-bold animate-pulse h-full justify-center mt-4">
                       <Loader2 size={18} className="animate-spin" />
                       در حال بارگذاری...
                    </div>
                 ) : hasReport ? (
                    <>
                      <div className="text-xs text-gray-500 mb-1">تاریخ ثبت:</div>
                      <div className="text-sm font-bold text-gray-700 font-mono mb-3">
                         {new Date(report.created_at).toLocaleDateString('fa-IR')}
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                         <button 
                            className="flex-1 text-xs bg-purple-50 text-purple-700 font-bold py-2 rounded-lg hover:bg-purple-100 transition flex items-center justify-center gap-1"
                         >
                            مشاهده <ChevronLeft size={12}/>
                         </button>
                         <button 
                            onClick={(e) => handleExport(e, report.id, selectedYear, month.id)}
                            className="flex-1 text-xs bg-green-50 text-green-700 font-bold py-2 rounded-lg hover:bg-green-100 transition flex items-center justify-center gap-1 border border-green-100"
                            disabled={isExporting}
                         >
                            {isExporting ? <Loader2 size={12} className="animate-spin"/> : <FileSpreadsheet size={14}/>}
                            {isExporting ? '...' : 'خروجی اکسل'}
                         </button>
                      </div>
                    </>
                 ) : (
                    <div className="text-sm text-gray-400 mt-2 font-medium">گزارشی ثبت نشده</div>
                 )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryView;
