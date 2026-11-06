import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import Icon from '../../../components/AppIcon';
import Select from '../../../components/ui/Select';

const gradeBucket = (p) => (p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F');
const bucketLabel = { A: 'A (90–100%)', B: 'B (80–89%)', C: 'C (70–79%)', D: 'D (60–69%)', F: 'F (0–59%)' };
const bucketOrder = ['A', 'B', 'C', 'D', 'F'];

const bucketColor = {
  A: 'var(--color-success, #34D399)',
  B: 'var(--color-primary, #60A5FA)',
  C: '#8B5CF6',
  D: 'var(--color-secondary, #93C5FD)',
  F: 'var(--color-error, #EF4444)',
};
const matchesBucket = (p, bucket) => bucket === 'all' ? true : gradeBucket(p) === bucket;

const val = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);
const avgOf = (arr) => (arr.length ? arr.reduce((s,v)=>s+v,0) / arr.length : 0);
const getPercent = (g, includeMissing) => (g && typeof g.percentage === 'number') ? g.percentage : (includeMissing ? 0 : null);

const collectAssignmentPercents = (students, grades, assignmentId, includeMissing, bucketFilter) =>
    students
        .map(s => getPercent(grades[`${s.id}-${assignmentId}`], includeMissing))
        .filter(v => v !== null && matchesBucket(v, bucketFilter));

const collectStudentPercents = (assignments, grades, studentId, includeMissing, bucketFilter) =>
    assignments
        .map(a => getPercent(grades[`${studentId}-${a.id}`], includeMissing))
        .filter(v => v !== null && matchesBucket(v, bucketFilter));

const useNarrow = () => {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 1024px)');
    const update = () => setNarrow(m.matches);
    update();
    m.addEventListener?.('change', update);
    return () => m.removeEventListener?.('change', update);
  }, []);
  return narrow;
};

const GradeAnalytics = ({ students = [], assignments = [], grades = {}, selectedClass = null }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [bucketFilter, setBucketFilter] = useState('all');
  const [includeMissing, setIncludeMissing] = useState(true);
  const isNarrow = useNarrow();

  const bucketOptions = [
    { value: 'all', label: 'All Grades' },
    { value: 'A', label: bucketLabel.A },
    { value: 'B', label: bucketLabel.B },
    { value: 'C', label: bucketLabel.C },
    { value: 'D', label: bucketLabel.D },
    { value: 'F', label: bucketLabel.F }
  ];

  const visiblePercentages = useMemo(() => {
    if (!students.length || !assignments.length) return [];
    const arr = [];
    for (const s of students) {
      for (const a of assignments) {
        const g = grades[`${s.id}-${a.id}`];
        if (g && typeof g.percentage === 'number') arr.push(g.percentage);
        else if (includeMissing) arr.push(0);
      }
    }
    return arr;
  }, [students, assignments, grades, includeMissing]);

  const filteredPercentages = useMemo(
      () => visiblePercentages.filter(p => matchesBucket(p, bucketFilter)),
      [visiblePercentages, bucketFilter]
  );
  const hasAnyRealNonZero = useMemo(
      () => visiblePercentages.some(v => v > 0),
      [visiblePercentages]
  );

  const stats = useMemo(() => {
    const vals = filteredPercentages;
    // No fallback - show zeros when no real data
    if (!vals.length || !hasAnyRealNonZero) {
      return { average: 0, median: 0, highest: 0, lowest: 0, totalAssignments: assignments.length, completionRate: 0, noData: true };
    }
    const sorted = [...vals].sort((a,b)=>a-b);
    const avg = avgOf(vals);
    const mid = sorted.length % 2 ? sorted[(sorted.length-1)/2] : (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
    const gradedSlots = students.reduce((acc, s) => {
      let c = 0;
      for (const a of assignments) {
        const g = grades[`${s.id}-${a.id}`];
        if (g && typeof g.percentage === 'number') c++;
      }
      return acc + c;
    }, 0);
    const totalSlots = students.length * Math.max(1, assignments.length);
    const completionRate = Math.round((gradedSlots / totalSlots) * 100);
    return { average: Math.round(avg), median: Math.round(mid), highest: Math.round(sorted[sorted.length-1]), lowest: Math.round(sorted[0]), totalAssignments: assignments.length, completionRate, noData: false };
  }, [filteredPercentages, hasAnyRealNonZero, assignments.length, students, grades]);

  const totals = useMemo(() => {
    const totalSlots = students.length * Math.max(1, assignments.length);
    // No fallback - compute from real data only
    let graded = 0;
    for (const s of students) {
      for (const a of assignments) {
        const g = grades[`${s.id}-${a.id}`];
        if (g && typeof g.percentage === 'number') graded++;
      }
    }
    const missing = Math.max(0, totalSlots - graded);
    const missingPct = totalSlots ? Math.round((missing / totalSlots) * 100) : 0;
    return { totalSlots, graded, missing, missingPct };
  }, [students, assignments, grades]);

  const distData = useMemo(() => {
    const vals = filteredPercentages;
    // No fallback - show empty buckets when no real data
    const buckets = { A:0,B:0,C:0,D:0,F:0 };
    vals.forEach(p => { buckets[gradeBucket(p)]++; });
    return bucketOrder.map(b => ({ bucket: b, name: bucketLabel[b], value: buckets[b], color: bucketColor[b] }));
  }, [filteredPercentages]);

  const perfData = useMemo(() => {
    // No fallback - return only real assignment data
    const real = assignments.map(a => {
      const vals = collectAssignmentPercents(students, grades, a.id, includeMissing, bucketFilter);
      const avg = avgOf(vals);
      const submissions = vals.filter(v => v !== 0 || !includeMissing).length;
      const short = a.name.length > 18 ? a.name.slice(0,18) + '…' : a.name;
      return { name: short, fullName: a.name, average: Math.round(avg), totalPoints: a.totalPoints, submissions };
    });
    return real;
  }, [assignments, students, grades, includeMissing, bucketFilter]);

  const trendData = useMemo(() => {
    // No fallback - return only real trend data from assignments
    const list = [...assignments].sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    return list.map(a => {
      const vals = collectAssignmentPercents(students, grades, a.id, includeMissing, bucketFilter);
      const avg = Math.round(avgOf(vals));
      const subs = vals.filter(v => v !== 0 || !includeMissing).length;
      const label = a?.dueDate ? new Date(a.dueDate).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : a?.name || '';
      return { label, average: avg, submissions: subs };
    });
  }, [assignments, students, grades, includeMissing, bucketFilter]);

  const studentAverages = useMemo(() => {
    // No fallback - return only real student data
    return students.map(s => {
      const vals = collectStudentPercents(assignments, grades, s.id, includeMissing, bucketFilter);
      const avg = avgOf(vals);
      return { id: s.id, name: s.name, avg: Math.round(avg) };
    });
  }, [students, assignments, grades, includeMissing, bucketFilter]);

  const top5 = useMemo(() => [...studentAverages].filter(s => s.avg >= 60).sort((a,b)=>b.avg - a.avg).slice(0, 5), [studentAverages]);
  // "Needs Attention" = students with avg < 70% (C grade threshold) - these need help
  const bottom5 = useMemo(() => [...studentAverages].filter(s => s.avg < 70).sort((a,b)=>a.avg - b.avg).slice(0, 5), [studentAverages]);

  const MissingToggle = () => (
      <div className="w-full md:w-auto max-w-full">
        <div role="group" aria-label="Missing grades handling" className="flex items-center gap-1 p-1 rounded-md border border-border bg-muted">
          <button
              type="button"
              onClick={() => setIncludeMissing(true)}
              aria-pressed={includeMissing}
              className={`inline-flex items-center justify-center gap-2 rounded transition-colors px-3 py-1.5 text-sm md:px-4 md:py-2 ${includeMissing ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:bg-muted/60'}`}
              title="Count missing grades as 0%"
          >
            <Icon name="CheckCircle2" size={isNarrow ? 12 : 16} />
            <span className="hidden lg:inline">Count = 0%</span>
            <span className="inline lg:hidden">0%</span>
          </button>

          <button
              type="button"
              onClick={() => setIncludeMissing(false)}
              aria-pressed={!includeMissing}
              className={`inline-flex items-center justify-center gap-2 rounded transition-colors px-3 py-1.5 text-sm md:px-4 md:py-2 ${!includeMissing ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:bg-muted/60'}`}
              title="Ignore missing grades"
          >
            <Icon name="Ban" size={isNarrow ? 12 : 16} />
            <span className="hidden lg:inline">Ignore</span>
            <span className="inline lg:hidden">Skip</span>
          </button>
        </div>

        <div className="mt-1 text-xs md:text-sm text-muted-foreground">
        <span className="hidden lg:inline">
          Graded <span className="text-foreground font-medium">{totals.graded}</span>/{totals.totalSlots} • Missing <span className="text-foreground font-medium">{totals.missing}</span> ({totals.missingPct}%)
        </span>
          <span className="lg:hidden">
          <span className="text-foreground font-medium">{totals.graded}</span>/{totals.totalSlots} • <span className="text-foreground font-medium">{totals.missing}</span> ({totals.missingPct}%)
        </span>
        </div>
      </div>
  );

  const renderOverview = () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:'Class Average', value:`${stats.average}%`, icon:'TrendingUp', bg:'bg-primary/10', ic:'text-primary' },
            { label:'Completion Rate', value:`${stats.completionRate}%`, icon:'CheckCircle', bg:'bg-success/10', ic:'text-success' },
            { label:'Total Assignments', value:stats.totalAssignments, icon:'BookOpen', bg:'bg-secondary/10', ic:'text-secondary' },
            { label:'Students (visible)', value:students.length, icon:'Users', bg:'bg-muted', ic:'text-foreground' },
          ].map((m) => (
              <div key={m.label} className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{m.label}</p>
                    <p className="text-2xl font-bold text-foreground">{m.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${m.bg}`}>
                    <Icon name={m.icon} size={20} className={m.ic} />
                  </div>
                </div>
              </div>
          ))}
        </div>

        <div className="bg-card p-4 sm:p-6 rounded-lg border border-border">
          <h4 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Assignment Performance</h4>
          <div className="h-[240px] sm:h-[300px] md:h-80 lg:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} domain={[0, 100]} tickFormatter={(t)=>`${t}%`} />
                <Tooltip
                    contentStyle={{ backgroundColor:'var(--color-card)', border:'1px solid var(--color-border)', borderRadius:'8px' }}
                    formatter={(v) => [`${v}%`, 'Class Average']}
                    labelFormatter={(label) => perfData.find(a => a.name === label)?.fullName || label}
                />
                <Bar dataKey="average" fill="var(--color-primary)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
  );

  const renderDistribution = () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card p-4 sm:p-6 rounded-lg border border-border">
            <h4 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Grade Distribution</h4>
            <div className="h-[240px] sm:h-[300px] md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <Pie
                      data={distData}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                      isAnimationActive
                      labelLine={false}
                      label={({ value, bucket }) => (value > 0 ? bucket : '')}
                  >
                    {distData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip
                      contentStyle={{ backgroundColor:'var(--color-card)', border:'1px solid var(--color-border)', borderRadius:'8px' }}
                      formatter={(v, _n, p) => {
                        const total = distData.reduce((s, d) => s + d.value, 0);
                        const pct = total ? Math.round((v / total) * 100) : 0;
                        return [`${v} students (${pct}%)`, bucketLabel[p?.payload?.bucket] || ''];
                      }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card p-4 sm:p-6 rounded-lg border border-border">
            <h4 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Distribution Details</h4>
            <div className="space-y-4">
              {distData.map(d => (
                  <div key={d.bucket} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-foreground truncate">{d.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-medium text-foreground">{d.value}</span>
                      <span className="text-muted-foreground ml-1">students</span>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );

  const renderTrends = () => (
      <div className="bg-card p-4 sm:p-6 rounded-lg border border-border">
        <h4 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Performance Trends</h4>
        <div className="h-[240px] sm:h-[300px] md:h-80 lg:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} domain={[0, 100]} tickFormatter={(t)=>`${t}%`} />
              <Tooltip
                  contentStyle={{ backgroundColor:'var(--color-card)', border:'1px solid var(--color-border)', borderRadius:'8px' }}
                  formatter={(v, n) => (n === 'average' ? [`${v}%`, 'Average'] : [v, 'Submissions'])}
              />
              <Line type="monotone" dataKey="average" stroke="var(--color-primary)" strokeWidth={3} dot={{ fill:'var(--color-primary)', strokeWidth:2, r:4 }} name="Average" isAnimationActive />
              <Line type="monotone" dataKey="submissions" stroke="var(--color-secondary)" strokeWidth={2} dot={{ fill:'var(--color-secondary)', strokeWidth:2, r:3 }} name="Submissions" isAnimationActive />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
  );

  const renderPerformance = () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card p-4 sm:p-6 rounded-lg border border-border">
            <h4 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Top Performers</h4>
            <div className="space-y-3">
              {[...top5].map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-primary">#{i + 1}</span>
                      </div>
                      <span className="text-foreground truncate">{s.name}</span>
                    </div>
                    <span className="font-medium text-success">{s.avg}%</span>
                  </div>
              ))}
            </div>
          </div>

          <div className="bg-card p-4 sm:p-6 rounded-lg border border-border">
            <h4 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Needs Attention</h4>
            <div className="space-y-3">
              {[...bottom5].map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-error/10 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="AlertTriangle" size={16} />
                      </div>
                      <span className="text-foreground truncate">{s.name}</span>
                    </div>
                    <span className="font-medium text-error">{s.avg}%</span>
                  </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':     return renderOverview();
      case 'distribution': return renderDistribution();
      case 'trends':       return renderTrends();
      case 'performance':  return renderPerformance();
      default:             return renderOverview();
    }
  };

  return (
      <section className="w-full">
        <div className="w-full glass-card rounded-lg border border-border overflow-hidden shadow-card" style={{ scrollbarGutter: 'stable both-edges' }}>
          <div className="px-4 sm:px-6 py-4 border-b border-border bg-surface/30">
            <div className="grid gap-4 items-end grid-cols-1 xl:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">Grade Analytics</h3>
                <p className="text-sm text-muted-foreground mt-1">Analysis of performance based on current filters</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs min-w-0">
                  <span className="px-2 py-1 rounded-full bg-secondary/10 text-secondary">Grades: {bucketOptions.find(b => b.value === bucketFilter)?.label}</span>
                  <span className={`px-2 py-1 rounded-full ${includeMissing ? 'bg-secondary/10 text-secondary' : 'bg-muted/40 text-muted-foreground'}`}>
                  {includeMissing ? 'Missing → 0%' : 'Missing → Ignore'}
                </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full xl:w-auto">
                <Select options={bucketOptions} value={bucketFilter} onChange={(v) => setBucketFilter(val(v))} className="w-full" />
                <MissingToggle />
              </div>
            </div>
          </div>

          <div className="border-b border-border">
            <nav className="flex flex-wrap md:flex-nowrap gap-x-6 gap-y-1 px-4 sm:px-6 overflow-x-auto thin-scrollbar" aria-label="Analytics tabs">
              {[
                { id: 'overview',     label: 'Overview',           icon: 'BarChart3' },
                { id: 'distribution', label: 'Grade Distribution', icon: 'PieChart' },
                { id: 'trends',       label: 'Trends',             icon: 'TrendingUp' },
                { id: 'performance',  label: 'Performance',        icon: 'Target' }
              ].map(t => (
                  <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-2 py-3 sm:py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                  ${activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'}`}
                  >
                    <Icon name={t.icon} size={16} />
                    <span>{t.label}</span>
                  </button>
              ))}
            </nav>
          </div>

          <div className="px-4 sm:px-6 py-4">{renderTab()}</div>
        </div>
      </section>
  );
};

export default GradeAnalytics;