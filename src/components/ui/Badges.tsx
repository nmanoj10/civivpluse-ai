import React from 'react';

export const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string, text: string, dot: string }> = {
    'SUBMITTED': { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
    'MEDIA_UPLOADED': { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
    'OPEN_FOR_COMMUNITY_VERIFICATION': { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
    'ASSIGNED_TO_AUTHORITY': { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
    'IN_PROGRESS': { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
    'RESOLVED': { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'CLOSED_RESOLVED': { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'REJECTED': { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
    'ESCALATED': { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' }
  };

  const current = styles[status] || { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-500' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${current.bg} ${current.text}`}>
      <span className={`w-2 h-2 rounded-full ${current.dot}`} />
      {(status || 'UNKNOWN').replace(/_/g, ' ')}
    </span>
  );
};

export const PriorityBadge = ({ level }: { level: string }) => {
  const styles: Record<string, { bg: string, text: string }> = {
    'LOW': { bg: 'bg-slate-105 text-slate-600 border-slate-200', text: 'Low' },
    'MEDIUM': { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'Medium' },
    'HIGH': { bg: 'bg-orange-50 text-orange-700 border-orange-200', text: 'High' },
    'CRITICAL': { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'Critical' }
  };

  const current = styles[level?.toUpperCase()] || { bg: 'bg-slate-105 text-slate-600 border-slate-200', text: level || 'LOW' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${current.bg}`}>
      {current.text}
    </span>
  );
};
