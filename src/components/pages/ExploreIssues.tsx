import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Compass, Search, Filter, ChevronLeft, ChevronRight, 
  AlertTriangle, List, Grid3X3, Map, MapPin, ThumbsUp, 
  BarChart3, Clock, RefreshCw, X
} from 'lucide-react';
import LeafletMap from '@/components/ui/LeafletMap';
import { connectSocket } from '@/utils/socket';
import { motion, AnimatePresence } from 'motion/react';

interface ExploreIssuesProps {
  user: any;
  token: string;
  onViewDetails: (issue: any) => void;
  IssueCardComponent: React.ComponentType<any>;
}

const CATEGORIES = ['Road & Transport', 'Water & Sanitation', 'Waste Management', 'Electrical & Lighting', 'Parks & Recreation', 'Public Safety', 'Other'];
const STATUSES = ['SUBMITTED', 'OPEN_FOR_COMMUNITY_VERIFICATION', 'ASSIGNED_TO_AUTHORITY', 'IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED'];
const STATUS_LABELS: Record<string, string> = {
  'SUBMITTED': 'Submitted',
  'OPEN_FOR_COMMUNITY_VERIFICATION': 'Open / Community',
  'ASSIGNED_TO_AUTHORITY': 'Assigned',
  'IN_PROGRESS': 'In Progress',
  'RESOLVED': 'Resolved',
  'CLOSED_RESOLVED': 'Closed Resolved'
};

const IssueListRow = ({ issue, onViewDetails }: { issue: any; onViewDetails: (i: any) => void; key?: string | number }) => {
  const mediaUrl = issue.thumbnail || issue.media?.[0]?.imageUrl || issue.media?.[0]?.url;
  const statusColors: Record<string, string> = {
    'RESOLVED': 'text-emerald-600 bg-emerald-50 border-emerald-200',
    'CLOSED_RESOLVED': 'text-emerald-600 bg-emerald-50 border-emerald-200',
    'IN_PROGRESS': 'text-indigo-600 bg-indigo-50 border-indigo-200',
    'ASSIGNED_TO_AUTHORITY': 'text-purple-600 bg-purple-50 border-purple-200',
  };
  const statusColor = statusColors[issue.status] || 'text-orange-600 bg-orange-50 border-orange-200';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-5 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group"
      onClick={() => onViewDetails(issue)}
    >
      <div className="w-28 h-20 shrink-0 bg-slate-900 rounded-xl overflow-hidden">
        {mediaUrl ? (
          <img src={mediaUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-slate-900" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-sm truncate group-hover:text-indigo-600 transition-colors">{issue.title}</h3>
            <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 mt-1 truncate">
              <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
              {issue.location?.address || issue.location?.locality || 'Location unavailable'}
            </p>
          </div>
          <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${statusColor}`}>
            {STATUS_LABELS[issue.status] || issue.status}
          </span>
        </div>
        <div className="flex items-center gap-5 mt-3 text-[10px] font-bold text-slate-400 flex-wrap">
          <span className="flex items-center gap-1 text-indigo-600">
            <ThumbsUp className="w-3 h-3" /> {issue.supportCount || issue.supporterCount || 0}
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Priority: {issue.priorityScore || 0}/100
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {new Date(issue.createdAt).toLocaleDateString()}
          </span>
          {issue.reportedCategory && (
            <span className="px-2.5 py-1 bg-slate-100 rounded-full font-bold text-slate-600">{issue.reportedCategory}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default function ExploreIssues({ user, token, onViewDetails, IssueCardComponent }: ExploreIssuesProps) {
  const [exploreIssuesList, setExploreIssuesList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDistance, setFilterDistance] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
  const [loading, setLoading] = useState(true);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildQueryParams = useCallback((targetPage: number) => {
    const q = new URLSearchParams();
    if (searchQuery) q.append('search', searchQuery);
    if (filterCategory) q.append('category', filterCategory);
    if (filterStatus) q.append('status', filterStatus);
    if (filterDistance) q.append('distance', filterDistance);
    if (filterDistance && user.lat && user.lng) {
      q.append('lat', user.lat.toString());
      q.append('lng', user.lng.toString());
    }
    q.append('sortBy', sortBy);
    q.append('page', targetPage.toString());
    q.append('limit', '12');
    return q;
  }, [searchQuery, filterCategory, filterStatus, filterDistance, sortBy, user.lat, user.lng]);

  const fetchExploreIssues = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/explore?${buildQueryParams(targetPage).toString()}`);
      const data = await res.json();
      if (data.success) {
        setExploreIssuesList(data.data.issues || []);
        setTotalPages(data.data.pagination?.pages || 1);
        setTotalItems(data.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Explore fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, page]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchExploreIssues(1);
    }, 400);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  // Immediate filters
  useEffect(() => {
    setPage(1);
    fetchExploreIssues(1);
  }, [filterCategory, filterStatus, filterDistance, sortBy]);

  useEffect(() => {
    fetchExploreIssues(page);
  }, [page]);

  // Socket.IO real-time updates for explore list
  useEffect(() => {
    const socket = connectSocket(token);

    const handleIssueUpdated = (updatedIssue: any) => {
      setExploreIssuesList(prev =>
        prev.map(i => i._id === updatedIssue._id ? { ...i, ...updatedIssue } : i)
      );
    };

    const handleVoteUpdated = (payload: any) => {
      const updated = payload.issue;
      if (!updated) return;
      setExploreIssuesList(prev =>
        prev.map(i => i._id === updated._id ? { ...i, ...updated } : i)
      );
    };

    socket.on('ISSUE_UPDATED', handleIssueUpdated);
    socket.on('NEW_SUPPORT', handleVoteUpdated);
    socket.on('NEW_REJECTION', handleVoteUpdated);
    socket.on('VOTE_UPDATED', handleVoteUpdated);

    return () => {
      socket.off('ISSUE_UPDATED', handleIssueUpdated);
      socket.off('NEW_SUPPORT', handleVoteUpdated);
      socket.off('NEW_REJECTION', handleVoteUpdated);
      socket.off('VOTE_UPDATED', handleVoteUpdated);
    };
  }, [token]);

  const clearFilters = () => {
    setFilterCategory('');
    setFilterStatus('');
    setFilterDistance('');
    setSortBy('newest');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = filterCategory || filterStatus || filterDistance || searchQuery;

  const mapCenter: [number, number] = user.lat && user.lng
    ? [user.lat, user.lng]
    : exploreIssuesList[0]?.location?.lat
      ? [exploreIssuesList[0].location.lat, exploreIssuesList[0].location.lng]
      : [12.9716, 77.5946];

  // Normalize issue data from API (handles both Issue and MasterIssue field naming)
  const normalizeIssue = (issue: any) => ({
    ...issue,
    supportCount: issue.supportCount ?? issue.supporterCount ?? 0,
    rejectCount: issue.rejectCount ?? 0,
    thumbnail: issue.thumbnail || issue.previewUrl || issue.media?.[0]?.thumbnailUrl || issue.media?.[0]?.imageUrl || null,
    location: issue.location || issue.location || {},
    priorityScore: issue.priorityScore || 0,
  });

  const renderIssues = (issues: any[]) => issues.map((rawIssue) => {
    const issue = normalizeIssue(rawIssue);
    return (
      <IssueCardComponent
        key={issue._id}
        issue={issue}
        onViewDetails={onViewDetails}
      />
    );
  });

  return (
    <div className="space-y-6">
      {/* Header with glassmorphism */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-[24px] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
                <Compass className="w-4 h-4 text-white" />
              </div>
              Explore Issues
              {totalItems > 0 && (
                <span className="text-sm font-bold text-slate-400 ml-1">({totalItems})</span>
              )}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Browse all public civic issues across the platform.</p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-50 border border-slate-100 p-1 rounded-xl gap-0.5">
              {([
                { mode: 'grid', Icon: Grid3X3, label: 'Grid' },
                { mode: 'list', Icon: List, label: 'List' },
                { mode: 'map', Icon: Map, label: 'Map' },
              ] as const).map(({ mode, Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={`${label} view`}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-bold transition-all ${
                    viewMode === mode 
                      ? 'bg-white shadow-sm text-indigo-600 border border-slate-100' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <button 
              onClick={() => fetchExploreIssues(page)}
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-xl transition-colors border border-slate-100 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              Filters
            </div>
            {hasActiveFilters && (
              <button 
                onClick={clearFilters}
                className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer transition-colors"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by title, address, officer, category..."
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Status */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>

            {/* Sort + Distance row */}
            <div className="flex gap-2 col-span-2 sm:col-span-3 lg:col-span-5">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="priority">Highest Priority</option>
                <option value="supporters">Most Supported</option>
              </select>
              <select
                value={filterDistance}
                onChange={e => setFilterDistance(e.target.value)}
                disabled={!user.lat || !user.lng}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer disabled:opacity-40"
              >
                <option value="">Any Distance</option>
                <option value="1">Within 1 km</option>
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="20">Within 20 km</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content area - Premium Glass Container */}
      <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-[28px] shadow-sm overflow-hidden">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5">
              {viewMode === 'list' ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 flex gap-5 animate-pulse">
                      <div className="w-28 h-20 bg-slate-100 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-3 py-1">
                        <div className="h-4 bg-slate-100 rounded-full w-4/5" />
                        <div className="h-3 bg-slate-100 rounded-full w-2/5" />
                        <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 p-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-[20px] overflow-hidden animate-pulse">
                      <div className="aspect-[4/3] bg-slate-100" />
                      <div className="p-5 space-y-3">
                        <div className="h-4 bg-slate-100 rounded-full w-3/4" />
                        <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                        <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                        <div className="h-10 bg-slate-100 rounded-xl mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : exploreIssuesList.length === 0 ? (
            <motion.div 
              key="empty" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-4 px-6"
            >
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                <Compass className="w-7 h-7 text-indigo-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">No issues found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search query</p>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-xl transition-colors shadow-sm cursor-pointer">
                  Clear All Filters
                </button>
              )}
            </motion.div>
          ) : viewMode === 'map' ? (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[550px]">
              <LeafletMap
                center={mapCenter}
                zoom={12}
                issues={exploreIssuesList}
                landmarks={[]}
                jurisdictionRadius={0}
                className="w-full h-full"
              />
              <div className="p-4 border-t border-slate-100 text-xs text-slate-500 font-semibold flex items-center justify-between">
                <span>Showing {exploreIssuesList.length} issues on map</span>
                <span className="text-indigo-600 font-bold">Click a marker to view details</span>
              </div>
            </motion.div>
          ) : viewMode === 'list' ? (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-3">
              {exploreIssuesList.map(issue => (
                <IssueListRow key={issue._id} issue={normalizeIssue(issue)} onViewDetails={onViewDetails} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
              <div className="grid grid-cols-1 gap-8">
                {renderIssues(exploreIssuesList)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer shadow-sm"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-9 h-9 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    pageNum === page 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer shadow-sm"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
