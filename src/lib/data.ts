export const MOCK_ISSUES = [
  { id: 'CIV-9021', type: 'Pothole', severity: 'High', status: 'Verified', location: 'Downtown Ave', time: '10m ago' },
  { id: 'CIV-9022', type: 'Water Leak', severity: 'Critical', status: 'Escalated', location: 'Westside Block 4', time: '1h ago' },
  { id: 'CIV-9023', type: 'Streetlight', severity: 'Medium', status: 'Reported', location: 'North Park Road', time: '2h ago' },
  { id: 'CIV-9024', type: 'Garbage', severity: 'Low', status: 'Resolved', location: 'Market Square', time: '1d ago' },
];

export const WORKFLOW_STEPS = [
  { title: 'Report', desc: 'Capture photo/video with auto-geo tagging.', icon: 'Camera' },
  { title: 'AI Verify', desc: 'Analyzes media, categorizes & detects fakes.', icon: 'BrainCircuit' },
  { title: 'Community', desc: 'Nearby residents upvote & confirm issue.', icon: 'Users' },
  { title: 'Action', desc: 'Routed to ward officer with SLA timer.', icon: 'Clock' },
  { title: 'Resolve', desc: 'Proof uploaded and citizens confirm closure.', icon: 'CheckCircle2' }
];

export const FEATURES = [
  { category: 'Smart Reporting', icon: 'Smartphone', items: ['Media-based reporting', 'Auto geolocation', 'Offline-first drafting'] },
  { category: 'AI Engine', icon: 'Cpu', items: ['Fake media detection', 'Duplicate merging', 'Severity scoring'] },
  { category: 'Operations', icon: 'Building2', items: ['Smart department routing', 'SLA escalation', 'Action logs'] }
];

export const METRICS = [
  { label: 'Issues Resolved', value: '14.2k+', trend: '+12%' },
  { label: 'AI Accuracy', value: '98.5%', trend: '+2%' },
  { label: 'Avg Resolution', value: '3.4 Days', trend: '-1.2d' },
  { label: 'Active Citizens', value: '45k+', trend: '+8%' }
];
