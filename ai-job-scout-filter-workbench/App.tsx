import React, { useState } from 'react';
import { ScoredJob, UserConfig, AppStatus, Job, DBStatus } from './types';
import { analyzeJobsBulk } from './services/geminiService';
import { ConfigPanel } from './components/ConfigPanel';
import { JobTable } = require('./components/JobTable');
import { ArrowLeft, Loader2, Download, CheckSquare, Square } from 'lucide-react';
import { API_BASE_URL } from './config';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [config, setConfig] = useState<UserConfig>({
    resumeText: '',
    naturalLanguagePreferences: '',
  });
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null); // New State

  // Check DB on Mount
  React.useEffect(() => {
    checkDb();
  }, []);

  const checkDb = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/db_check`);
      const data = await res.json();
      setDbStatus(data);
    } catch (e) {
      console.error("Failed to check DB", e);
      setDbStatus({ exists: false, count: 0, filename: null });
    }
  };

  const handleRunScraper = async () => {
    setStatus(AppStatus.PARSING);
    setProgressMsg('正在启动爬虫程序...');
    
    try {
       // Trigger Scraper
       const res = await fetch(`${API_BASE_URL}/api/scrape`, { method: 'POST' });
       if (!res.ok) throw new Error("Failed to start scraper");
       
       // Poll Status
       while (true) {
          const statusResp = await fetch(`${API_BASE_URL}/api/status`);
          const statusData = await statusResp.json();
          
          if (statusData.is_running) {
             const { current, total, message } = statusData;
             setProgressMsg(`正在抓取职位 (${current}/${total > 0 ? total : '?'}) : ${message}`);
             await new Promise(r => setTimeout(r, 1000)); // Wait 1s
          } else {
             break;
          }
       }
       
       // Refresh DB Status
       await checkDb();
       setStatus(AppStatus.IDLE);
       
    } catch (e) {
       console.error(e);
       alert("抓取失败，请检查后台日志。");
       setStatus(AppStatus.IDLE);
    }
  };

  const startProcess = async () => {
    setHasError(false);
    setStatus(AppStatus.PARSING);
    setProgressMsg('正在读取数据...');
    setJobs([]);

    let parsedJobs: Job[] = [];

    try {
      // 1. Fetch Jobs (Now we expect it to be ready)
      const response = await fetch(`${API_BASE_URL}/api/jobs`);
      const data = await response.json();

      // If missing for some reason (race condition), handle it
      if (data.status === 'missing') {
         alert("数据不存在，请先运行抓取。");
         setStatus(AppStatus.IDLE);
         checkDb(); // Refresh UI
         return;
      }

      if (data.status === 'ready' && data.jobs) {
         parsedJobs = data.jobs;
      } else {
         throw new Error('Failed to load jobs');
      }

    } catch (e) {
      console.error(e);
      setHasError(true);
      setStatus(AppStatus.IDLE);
      return;
    }
    
    if (parsedJobs.length === 0) {
      alert("未发现有效职位。");
      setStatus(AppStatus.IDLE);
      return;
    }

    const initialJobs: ScoredJob[] = parsedJobs.map(j => ({ ...j, isSelected: false }));
    setJobs(initialJobs);
    
    // Step 2: Batch Analysis
    setStatus(AppStatus.ANALYZING);
    setProgressMsg(`Gemini 2.5 Pro 正在准备分析 ${parsedJobs.length} 个职位...`);

    // Perform bulk analysis with progress callback
    const analysisMap = await analyzeJobsBulk(parsedJobs, config, (current, total) => {
        setProgressMsg(`Gemini 2.5 Pro 正在深度分析: ${current}/${total} 个职位...`);
    });
    
    // Map results back to jobs
    const finalJobs: ScoredJob[] = initialJobs.map(job => {
      const analysis = analysisMap[job.id];
      
      // Fallback if AI missed a job in the batch output
      const finalAnalysis = analysis || {
        score: 0,
        recommendation: '不推荐',
        reasoning: '分析失败或已跳过。',
        pros: [],
        cons: []
      };

      return {
        ...job,
        analysis: finalAnalysis,
        isSelected: finalAnalysis.score >= 80
      };
    });

    // Sort by score
    setJobs(finalJobs.sort((a, b) => (b.analysis?.score || 0) - (a.analysis?.score || 0)));
    setStatus(AppStatus.REVIEW);
  };


  const handleToggleSelect = (id: string) => {
    setJobs(jobs.map(j => j.id === id ? { ...j, isSelected: !j.isSelected } : j));
  };

  const handleToggleSelectAll = () => {
    const allSelected = jobs.length > 0 && jobs.every(j => j.isSelected);
    setJobs(jobs.map(j => ({ ...j, isSelected: !allSelected })));
  };

  const handleExport = () => {
    const selected = jobs.filter(j => j.isSelected);
    if (selected.length === 0) return;

    const csvContent = '\uFEFF' + [
      ['职位', '公司', '地点', 'AI 评分', '推荐理由', 'URL'],
      ...selected.map(j => [
        `"${j.title.replace(/"/g, '""')}"`,
        `"${j.company.replace(/"/g, '""')}"`,
        `"${j.location.replace(/"/g, '""')}"`,
        j.analysis?.score,
        `"${j.analysis?.reasoning.replace(/"/g, '""')}"`,
        j.url
      ])
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `job_scout_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const selectedCount = jobs.filter(j => j.isSelected).length;
  const isAllSelected = jobs.length > 0 && jobs.every(j => j.isSelected);

  return (
    <div className="min-h-screen text-stone-900 font-serif selection:bg-stone-200 selection:text-stone-900 relative">
      
      {/* Error Overlay */}
      {hasError && (
        <div className="fixed inset-0 z-50 bg-stone-900/90 flex items-center justify-center p-8 backdrop-blur-sm animate-fade-in">
           <div className="bg-white p-12 max-w-lg w-full text-center space-y-6 shadow-2xl">
              <div className="text-red-600 mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-red-50">
                 <ArrowLeft className="w-6 h-6 rotate-180" /> {/* Improvising icon */}
              </div>
              <h3 className="text-2xl font-serif font-bold text-stone-900">数据加载失败</h3>
              <p className="text-stone-500 font-sans-clean">
                 无法连接到后台服务或抓取数据。请确保 server.py 正在运行，并且网络连接正常。
              </p>
              <button 
                onClick={() => startProcess()}
                className="w-full bg-stone-900 text-white py-4 uppercase tracking-widest font-bold hover:bg-stone-800 transition-colors"
              >
                重试 (Retry)
              </button>
              <button 
                onClick={() => setHasError(false)}
                className="text-stone-400 text-sm hover:text-stone-900"
              >
                取消
              </button>
           </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col min-h-screen">
        
        <main className="max-w-7xl mx-auto px-8 md:px-16 flex-grow w-full py-12 md:py-24">
          
          {/* Status: IDLE */}
          {status === AppStatus.IDLE && (
            <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
               
               {/* Left Column: Heading */}
               <div className="lg:sticky lg:top-24 space-y-8">
                 <div>
                   <h2 className="text-5xl md:text-7xl font-display font-medium tracking-tighter text-stone-900 mb-6 leading-[0.9]">
                     智能.<br/>
                     <span className="text-stone-300">筛选.</span> 决策.
                   </h2>
                   <div className="w-16 h-1 bg-stone-900 mb-6"></div>
                   <p className="text-lg md:text-xl text-stone-500 font-light leading-relaxed max-w-md">
                     您的私人 AI 招聘顾问。 <br/>
                     自动抓取最新职位，深度解析简历匹配度，让 AI 为您精准锁定最佳机会。
                   </p>
                 </div>
               </div>
               
               {/* Right Column: Configuration */}
               <div className="w-full">
                  <ConfigPanel 
                    config={config} 
                    setConfig={setConfig} 
                    onStart={startProcess} 
                    onScrape={handleRunScraper}
                    status={status}
                    dbStatus={dbStatus}
                  />
               </div>
            </div>
          )}

          {/* Status: PROCESSING */}
          {(status === AppStatus.PARSING || status === AppStatus.ANALYZING) && (
            <div className="flex flex-col items-center justify-center min-h-[80vh] animate-fade-in">
               <div className="text-center space-y-8">
                  <div className="inline-block relative">
                     <div className="absolute inset-0 bg-stone-200 blur-xl rounded-full opacity-50"></div>
                     <Loader2 className="relative z-10 w-16 h-16 animate-spin text-stone-900 mx-auto" />
                  </div>
                  
                  <div>
                    <h3 className="text-3xl font-display italic text-stone-900 mb-2">
                       {status === AppStatus.PARSING ? '读取数据...' : '深度分析中'}
                    </h3>
                    <p className="text-stone-400 font-sans-clean uppercase tracking-widest text-sm">
                       {progressMsg}
                    </p>
                  </div>
               </div>
            </div>
          )}

          {/* Status: REVIEW */}
          {status === AppStatus.REVIEW && (
            <div className="animate-fade-in pt-4 pb-32">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
                 {/* Header for Review Mode */}
                 <div>
                    <div 
                      onClick={() => setStatus(AppStatus.IDLE)} 
                      className="cursor-pointer text-stone-400 hover:text-stone-900 flex items-center gap-2 mb-4 transition-colors"
                    >
                       <ArrowLeft className="w-4 h-4" /> 返回首页
                    </div>
                    <h2 className="text-5xl font-display font-medium text-stone-900 mb-4">分析报告</h2>
                    <p className="text-stone-500 font-sans-clean text-sm tracking-widest uppercase">
                      已分析 {jobs.length} 个职位 · 筛选出 {selectedCount} 个意向
                    </p>
                </div>
                
                <div className="flex items-center gap-6 font-sans-clean text-sm font-bold">
                   <button
                    onClick={handleToggleSelectAll}
                    className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors"
                   >
                     {isAllSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                     {isAllSelected ? '取消全选' : '全选'}
                   </button>

                   <button
                    onClick={handleExport}
                    disabled={selectedCount === 0}
                    className={`
                      flex items-center gap-2 px-8 py-4 uppercase tracking-widest transition-all
                      ${selectedCount > 0 
                        ? 'bg-stone-900 text-white hover:bg-stone-800' 
                        : 'bg-stone-100 text-stone-300 cursor-not-allowed'}
                    `}
                  >
                    <Download className="w-4 h-4" />
                    导出结果
                  </button>
                </div>
              </div>

              <JobTable jobs={jobs} onToggleSelect={handleToggleSelect} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;