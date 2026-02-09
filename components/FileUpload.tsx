import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface FileUploadProps {
  label: string;
  description: string;
  accept?: string;
  onFileLoaded: (content: ArrayBuffer) => void;
  isLoaded: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  description, 
  accept = ".xlsx, .xls", 
  onFileLoaded, 
  isLoaded 
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState<string>('');
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setStatus('loading');
      
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const buffer = event.target?.result;
        if (buffer instanceof ArrayBuffer) {
          // Simulate a small delay for UI feel if file is tiny, 
          // or allow React to render the loading state before heavy parsing blocks main thread
          setTimeout(() => {
            try {
              onFileLoaded(buffer);
              setStatus('success');
            } catch (err) {
              setStatus('error');
            }
          }, 500);
        }
      };

      reader.onerror = () => {
        setStatus('error');
      };

      reader.readAsArrayBuffer(file); 
    }
  };

  return (
    <div className={`
      relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300
      ${status === 'success' || isLoaded 
        ? 'border-green-400 bg-green-50/50' 
        : status === 'error' 
          ? 'border-red-300 bg-red-50'
          : 'border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50/30'}
    `}>
      
      {/* Icon State */}
      <div className={`
        p-4 rounded-full mb-4 transition-all duration-500
        ${status === 'success' || isLoaded 
          ? 'bg-green-100 text-green-600 scale-110' 
          : status === 'loading'
            ? 'bg-blue-100 text-blue-600'
            : status === 'error'
              ? 'bg-red-100 text-red-600'
              : 'bg-gray-100 text-gray-500'}
      `}>
        {status === 'loading' ? (
          <Loader2 size={28} className="animate-spin" />
        ) : status === 'success' || isLoaded ? (
          <CheckCircle2 size={28} />
        ) : status === 'error' ? (
          <XCircle size={28} />
        ) : (
          <FileSpreadsheet size={28} />
        )}
      </div>

      <h3 className="font-bold text-gray-800 text-lg">{label}</h3>
      <p className="text-sm text-gray-500 mt-2 mb-6 px-4 leading-relaxed">{description}</p>
      
      {/* Badge / Button Area */}
      <div className="h-10 flex items-center justify-center w-full">
        {status === 'loading' ? (
          <div className="flex items-center gap-2 text-blue-600 text-sm font-medium animate-pulse">
            <span>در حال پردازش فایل...</span>
          </div>
        ) : (status === 'success' || isLoaded) ? (
          <div className="flex flex-col items-center animate-fade-in-up">
            <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 border border-green-200 shadow-sm">
              <CheckCircle2 size={16} />
              بارگذاری موفق
            </span>
            {fileName && <span className="text-xs text-green-600 mt-1 truncate max-w-[200px]">{fileName}</span>}
          </div>
        ) : (
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all hover:shadow-lg shadow-blue-200 active:scale-95 flex items-center gap-2">
            <Upload size={18} />
            انتخاب فایل اکسل
            <input 
              type="file" 
              className="hidden" 
              accept={accept} 
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      {status === 'error' && (
        <span className="mt-4 text-xs font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full">
          خطا در خواندن فایل
        </span>
      )}
    </div>
  );
};

export default FileUpload;