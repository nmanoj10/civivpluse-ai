import React from 'react';

export default function ProgressTimeline({ status }: { status: string }) {
  const steps = [
    { label: 'Reported', completed: true },
    { label: 'AI Analysis', completed: status !== 'SUBMITTED' },
    { label: 'Community', completed: !['SUBMITTED', 'MEDIA_UPLOADED', 'OPEN_FOR_COMMUNITY_VERIFICATION'].includes(status) },
    { label: 'Assigned', completed: !['SUBMITTED', 'MEDIA_UPLOADED', 'OPEN_FOR_COMMUNITY_VERIFICATION'].includes(status) },
    { label: 'In Progress', completed: ['IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED', 'CLOSED'].includes(status) },
    { label: 'Resolved', completed: ['RESOLVED', 'CLOSED_RESOLVED'].includes(status) }
  ];

  return (
    <div className="w-full mt-4">
      <div className="flex justify-between items-center relative">
        <div className="absolute left-0 right-0 top-3.5 h-0.5 bg-slate-200 z-0" />
        
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center z-10">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-[11px] font-bold transition-all duration-300 ${
              step.completed 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                : 'bg-white border-slate-200 text-slate-400'
            }`}>
              {step.completed ? '✓' : '○'}
            </div>
            <span className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
