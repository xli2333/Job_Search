import React, { useState } from 'react';
import { ScoredJob } from '../types';
import { Check, ChevronDown, ExternalLink, Minus, Plus } from 'lucide-react';

interface JobTableProps {
  jobs: ScoredJob[];
  onToggleSelect: (id: string) => void;
}

export const JobTable: React.FC<JobTableProps> = ({ jobs, onToggleSelect }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getScoreStyle = (score: number) => {
    if (score >= 80) return 'text-stone-900 border-stone-900';
    if (score >= 50) return 'text-amber-700 border-amber-700';
    return 'text-stone-300 border-stone-300';
  };

  return (
    <div className="space-y-0 divide-y divide-stone-200 border-t border-b border-stone-200">
      {jobs.map((job, index) => {
        const isExpanded = expandedId === job.id;
        const score = job.analysis?.score || 0;
        const isSelected = job.isSelected;

        return (
          <div 
            key={job.id}
            className={`
              group transition-colors duration-500
              ${isExpanded ? 'bg-stone-50' : 'bg-transparent hover:bg-stone-50/50'}
            `}
          >
            {/* Header Row */}
            <div 
              className="py-10 cursor-pointer grid grid-cols-12 gap-6 items-start"
              onClick={() => toggleExpand(job.id)}
            >
              {/* Checkbox Column */}
              <div className="col-span-1 flex justify-center pt-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onToggleSelect(job.id)}
                  className={`
                    w-6 h-6 border transition-all duration-300 flex items-center justify-center
                    ${isSelected 
                      ? 'bg-stone-900 border-stone-900 text-white' 
                      : 'bg-transparent border-stone-300 hover:border-stone-900'
                    }
                  `}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
              </div>

              {/* Main Info */}
              <div className="col-span-9 space-y-3">
                <div className="flex items-baseline justify-between pr-8">
                  <h3 className="text-3xl font-serif font-medium text-stone-900 leading-tight group-hover:underline decoration-1 underline-offset-4 decoration-stone-300">
                    {job.title}
                  </h3>
                </div>
                
                <div className="flex items-center gap-4 text-sm font-sans-clean tracking-wider uppercase text-stone-500">
                  <span className="font-bold text-stone-900">{job.company}</span>
                  <span className="w-px h-3 bg-stone-300"></span>
                  <span>{job.location}</span>
                  <span className="w-px h-3 bg-stone-300"></span>
                  <span>{job.postedDate}</span>
                </div>

                {/* Visible Description Snippet */}
                <p className="text-stone-600 font-serif leading-relaxed line-clamp-2 pt-2 pr-8 opacity-80">
                  {job.description}
                </p>
                
                {/* Mobile/Quick Analysis Reasoning Snippet */}
                <div className="pt-2 flex items-start gap-2">
                   <span className="text-xs font-bold bg-stone-200 px-2 py-0.5 rounded text-stone-600">AI</span>
                   <span className="text-sm text-stone-500 italic">"{job.analysis?.reasoning}"</span>
                </div>
              </div>

              {/* Score & Action */}
              <div className="col-span-2 flex flex-col items-end justify-between h-full min-h-[120px]">
                 <div className={`text-4xl font-display font-light ${score >= 80 ? 'text-stone-900' : 'text-stone-400'}`}>
                    {score}<span className="text-lg align-top ml-1">%</span>
                 </div>
                 <div className="text-xs font-bold uppercase tracking-widest text-stone-400 mt-1 mb-auto">
                    {job.analysis?.recommendation}
                 </div>

                 <div className="mt-4 flex items-center gap-4">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-900 transition-colors"
                      title="直接投递 (Apply on LinkedIn)"
                      onClick={(e) => e.stopPropagation()}
                    >
                       <ExternalLink className="w-5 h-5" />
                    </a>
                    {isExpanded ? <Minus className="w-6 h-6 text-stone-900" /> : <Plus className="w-6 h-6 text-stone-300 group-hover:text-stone-900 transition-colors" />}
                 </div>
              </div>
            </div>

            {/* Expanded Details */}
            <div 
              className={`
                overflow-hidden transition-all duration-500 ease-in-out
                ${isExpanded ? 'max-h-[1000px] opacity-100 pb-12' : 'max-h-0 opacity-0'}
              `}
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pl-[8.33%] pr-8">
                {/* Full Description */}
                <div className="md:col-span-7 space-y-6 text-stone-700">
                   <h4 className="font-sans-clean text-xs font-bold uppercase tracking-widest text-stone-400 border-b border-stone-200 pb-2">职位详情</h4>
                   <p className="font-serif leading-8 whitespace-pre-line text-lg">
                      {job.description}
                   </p>
                   
                   <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-stone-100">
                     <a 
                      href={job.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex justify-center items-center gap-2 bg-stone-900 text-white px-8 py-3 uppercase tracking-widest font-bold hover:bg-stone-800 transition-all"
                     >
                       立即申请 <ExternalLink className="w-4 h-4" />
                     </a>
                     
                     <a 
                      href={job.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex justify-center items-center gap-2 text-stone-500 hover:text-stone-900 px-6 py-3 transition-colors"
                     >
                       查看原始链接
                     </a>
                   </div>
                </div>

                {/* Analysis Deep Dive */}
                <div className="md:col-span-5 bg-white p-8 space-y-8 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)]">
                   <h4 className="font-sans-clean text-xs font-bold uppercase tracking-widest text-stone-400 border-b border-stone-200 pb-2">AI 深度分析</h4>
                   
                   <div>
                      <span className="block text-sm text-stone-400 mb-2">匹配亮点</span>
                      <ul className="space-y-3">
                        {job.analysis?.pros.map((pro, i) => (
                           <li key={i} className="flex items-start gap-3 text-stone-700">
                              <span className="mt-1.5 w-1 h-1 bg-stone-900 rounded-full flex-shrink-0"></span>
                              <span className="leading-relaxed">{pro}</span>
                           </li>
                        ))}
                      </ul>
                   </div>

                   {job.analysis?.cons && job.analysis.cons.length > 0 && (
                     <div>
                        <span className="block text-sm text-stone-400 mb-2">潜在风险</span>
                        <ul className="space-y-3">
                          {job.analysis?.cons.map((con, i) => (
                             <li key={i} className="flex items-start gap-3 text-stone-500 italic">
                                <span className="mt-1.5 w-1 h-1 bg-amber-600 rounded-full flex-shrink-0"></span>
                                <span className="leading-relaxed">{con}</span>
                             </li>
                          ))}
                        </ul>
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};