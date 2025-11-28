import React, { useRef, useState } from 'react';
import { UserConfig, AppStatus, DBStatus } from '../types';
import { Upload, FileText, Sparkles, FileSpreadsheet, X, RefreshCw } from 'lucide-react';

interface ConfigPanelProps {
  config: UserConfig;
  setConfig: React.Dispatch<React.SetStateAction<UserConfig>>;
  onStart: () => void;
  onScrape: () => void;
  status: AppStatus;
  dbStatus: DBStatus | null;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, setConfig, onStart, onScrape, status, dbStatus }) => {
  const resumeInputRef = useRef<HTMLInputElement>(null);
  
  const [activeResumeTab, setActiveResumeTab] = useState<'upload' | 'text'>('upload');

  const isScanning = status === AppStatus.ANALYZING || status === AppStatus.PARSING;

  const handleChange = (field: keyof UserConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("请上传 PDF 格式的简历。");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      const base64Content = base64String.split(',')[1];
      
      setConfig(prev => ({
        ...prev,
        resumeFileName: file.name,
        resumeMimeType: file.type,
        resumeBase64: base64Content,
        resumeText: "Attached PDF"
      }));
    };
    reader.readAsDataURL(file);
  };

  const clearResume = () => {
    setConfig(prev => ({
      ...prev,
      resumeFileName: undefined,
      resumeMimeType: undefined,
      resumeBase64: undefined,
      resumeText: ''
    }));
    if (resumeInputRef.current) resumeInputRef.current.value = '';
  };

  return (
    <div className="w-full space-y-12">
      
      {/* Data Status Indicator */}
      <div className="flex flex-col items-start gap-4">
        {dbStatus === null ? (
           <div className="flex items-center gap-2 text-stone-500 bg-stone-100 px-4 py-2 rounded-full w-fit text-xs font-bold uppercase tracking-widest border border-stone-200">
             <RefreshCw className="w-4 h-4 animate-spin" />
             <span>Checking Database...</span>
           </div>
        ) : dbStatus.exists ? (
           <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full w-fit text-xs font-bold uppercase tracking-widest border border-emerald-100">
             <FileSpreadsheet className="w-4 h-4" />
             <span>Database Connected ({dbStatus.count} Jobs)</span>
           </div>
        ) : (
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-red-700 bg-red-50 px-4 py-2 rounded-full w-fit text-xs font-bold uppercase tracking-widest border border-red-100">
                <X className="w-4 h-4" />
                <span>No Data Found</span>
              </div>
              <button 
                onClick={onScrape}
                disabled={isScanning}
                className="text-xs font-bold uppercase tracking-widest border-b border-stone-900 pb-0.5 hover:text-amber-700 hover:border-amber-700 transition-colors"
              >
                Run Scraper Now
              </button>
           </div>
        )}
      </div>

      {/* 1. Resume */}
      <section className="space-y-6">
        <h3 className="text-2xl font-light italic font-display border-b border-stone-200 pb-4 flex justify-between items-end">
          <div>
            <span className="text-stone-400 mr-4 not-italic font-sans text-sm tracking-widest uppercase">01</span>
            简历
          </div>
          <div className="flex gap-4 text-sm font-sans-clean not-italic">
              <button 
                onClick={() => setActiveResumeTab('upload')}
                className={`transition-colors ${activeResumeTab === 'upload' ? 'text-stone-900 font-bold underline decoration-2 underline-offset-4' : 'text-stone-400 hover:text-stone-600'}`}
              >
                PDF
              </button>
              <button 
                onClick={() => setActiveResumeTab('text')}
                className={`transition-colors ${activeResumeTab === 'text' ? 'text-stone-900 font-bold underline decoration-2 underline-offset-4' : 'text-stone-400 hover:text-stone-600'}`}
              >
                文本
              </button>
          </div>
        </h3>

        <div className="min-h-[100px]">
            {activeResumeTab === 'upload' ? (
              <div>
                  {!config.resumeFileName ? (
                    <div 
                      onClick={() => resumeInputRef.current?.click()}
                      className="border-b border-stone-300 py-6 flex items-center justify-between cursor-pointer group hover:border-stone-900 transition-colors"
                    >
                        <span className="font-serif text-xl text-stone-900">点击上传 PDF</span>
                        <Upload className="w-5 h-5 text-stone-400 group-hover:text-stone-900 transition-colors" />
                        <input 
                        type="file" 
                        ref={resumeInputRef} 
                        className="hidden" 
                        accept="application/pdf"
                        onChange={handleResumeUpload}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between border-b border-stone-900 py-4">
                        <div className="flex items-center gap-4">
                          <FileText className="w-5 h-5 text-stone-900" />
                          <span className="font-serif text-lg truncate max-w-[200px]">{config.resumeFileName}</span>
                        </div>
                        <button 
                          onClick={clearResume}
                          className="text-stone-400 hover:text-red-700 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                    </div>
                  )}
              </div>
            ) : (
              <textarea
                className="w-full bg-transparent border-l-2 border-stone-200 pl-4 py-2 text-stone-600 focus:border-stone-900 outline-none resize-none transition-colors font-sans-clean h-32"
                placeholder="在此粘贴简历文本..."
                value={config.resumeText === 'Attached PDF' ? '' : config.resumeText}
                onChange={(e) => handleChange('resumeText', e.target.value)}
              />
            )}
        </div>
      </section>

      {/* 2. Preferences */}
      <section className="space-y-6">
        <h3 className="text-2xl font-light italic font-display border-b border-stone-200 pb-4">
          <span className="text-stone-400 mr-4 not-italic font-sans text-sm tracking-widest uppercase">02</span>
          偏好设置
        </h3>
        
        <div className="relative group">
            <div className="absolute top-0 left-0 text-stone-300 pointer-events-none">
              <Sparkles className="w-5 h-5" />
            </div>
            <textarea
              className="w-full min-h-[150px] bg-transparent text-xl font-serif text-stone-900 placeholder:text-stone-300 outline-none resize-none leading-relaxed pl-8 focus:placeholder:text-stone-200 transition-colors"
              placeholder="告诉我你理想的工作是什么样的..."
              value={config.naturalLanguagePreferences}
              onChange={(e) => handleChange('naturalLanguagePreferences', e.target.value)}
            />
        </div>
      </section>

      {/* Action Button */}
      <div className="pt-4">
        <button
          onClick={() => onStart()}
          disabled={(!config.resumeText && !config.resumeBase64) || isScanning || !dbStatus?.exists}
          className={`
            w-full relative overflow-hidden py-5 text-base tracking-widest uppercase font-bold transition-all duration-500
            ${(!config.resumeText && !config.resumeBase64) || isScanning || !dbStatus?.exists
              ? 'text-stone-300 cursor-not-allowed bg-stone-50'
              : 'bg-stone-900 text-stone-50 hover:bg-stone-800'
            }
          `}
        >
          <span className="relative z-10 flex items-center justify-center gap-4">
              {status === AppStatus.IDLE ? '开始分析 (Start Analysis)' : '分析中...'}
          </span>
        </button>
      </div>
    </div>
  );
};