// src/pages/student-studies/components/ScholarshipsView.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToasts } from '../../../components/ui/Toasts';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';
import { UL } from './Primitives';
import Alert from './Alert';
import Dialog from './Dialog';
import { asString, H } from '../utils/studentStudiesUtils';
import { fetchStudentRanking, fetchStudentRankingPosition } from '../../../data/maisApiAdapter';

export default function ScholarshipsView({ gpa, studentId }) {
    const { notify } = useToasts();
    const toastLocks = useRef({});
    const guardedNotify = useCallback((key, type, message, opts = {}) => {
        if (key) {
            const now = Date.now();
            const lock = opts.lockMs ?? 2600;
            const prev = toastLocks.current[key] ?? 0;
            if (now - prev < lock) return;
            toastLocks.current[key] = now;
        }
        notify(type, message, opts);
    }, [notify]);
    const navigate = useNavigate();
    const location = useLocation();
    const qp = new URLSearchParams(location.search);
    const initialDialog = qp.get('scholarship') || '';
    const [dialog, setDialog] = useState(initialDialog);

    const openDialog = useCallback((k) => {
        const nx = new URLSearchParams(location.search);
        if (k) nx.set('scholarship', k);
        else nx.delete('scholarship');
        navigate({ search: `?${nx.toString()}` }, { replace: false });
        setDialog(k);
    }, [location.search, navigate]);

    useEffect(() => { setDialog(initialDialog); }, [initialDialog]);

    const eligibleMerit = Number(gpa) >= 1.8;
    const [needInput, setNeedInput] = useState({ incomeMonthly: '', household: '1' });

    const perCapita = useMemo(() => {
        const inc = parseFloat(needInput.incomeMonthly || '0');
        const hh = Math.max(1, parseInt(needInput.household || '1', 10));
        return Math.round((inc / hh) * 100) / 100;
    }, [needInput]);

    const likelyEligible = perCapita > 0 && perCapita < 500;

    // Fetch real ranking data from API
    const [rankingData, setRankingData] = useState({ ranking: [], total: 0 });
    const [myPosition, setMyPosition] = useState(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        const loadRanking = async () => {
            if (!studentId) {
                console.log('[ScholarshipsView] No studentId, skipping ranking load');
                return;
            }
            setLoading(true);
            try {
                console.log('[ScholarshipsView] Loading ranking for student:', studentId);
                const [ranking, position] = await Promise.all([
                    fetchStudentRanking({ limit: 200 }),
                    fetchStudentRankingPosition(studentId)
                ]);
                console.log('[ScholarshipsView] Ranking loaded:', ranking);
                console.log('[ScholarshipsView] Position loaded:', position);
                setRankingData(ranking || { ranking: [], total: 0 });
                setMyPosition(position);
            } catch (e) {
                console.error('[ScholarshipsView] Failed to load ranking:', e);
            } finally {
                setLoading(false);
            }
        };
        loadRanking();
    }, [studentId]);
    
    // Transform ranking data for display, marking current student as "You"
    const population = useMemo(() => {
        const list = (rankingData.ranking || []).map(item => ({
            name: item.studentId === studentId ? 'You' : item.name,
            gpa: item.gpa,
            ects: item.ects,
            rank: item.rank,
            isMe: item.studentId === studentId
        }));
        // If current student not in list, add them
        if (myPosition && !list.some(s => s.isMe)) {
            list.push({
                name: 'You',
                gpa: myPosition.gpa,
                ects: myPosition.ects,
                rank: myPosition.position,
                isMe: true
            });
        }
        return list;
    }, [rankingData, studentId, myPosition]);

    const [sortBy, setSortBy] = useState('gpa');
    const [limit, setLimit] = useState('25');
    const [q, setQ] = useState('');

    const sorted = useMemo(() => {
        const arr = [...population];
        if (sortBy === 'ects') arr.sort((a, b) => b.ects - a.ects || b.gpa - a.gpa);
        else arr.sort((a, b) => b.gpa - a.gpa || b.ects - a.ects);
        return arr;
    }, [population, sortBy]);

    const filtered = useMemo(() => (q.trim() ? sorted.filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase())) : sorted), [sorted, q]);
    // Use real position from API if available
    const position = useMemo(() => {
        if (myPosition?.position) return myPosition.position;
        const idx = filtered.findIndex(s => s.name === 'You');
        return idx >= 0 ? idx + 1 : filtered.length;
    }, [filtered, myPosition]);
    const percentile = useMemo(() => {
        if (myPosition?.percentile !== undefined) return Math.round(myPosition.percentile);
        const total = rankingData.total || filtered.length;
        return total > 0 ? Math.round((1 - (position - 1) / Math.max(1, total - 1)) * 100) : 0;
    }, [position, filtered.length, myPosition, rankingData.total]);
    const limited = useMemo(() => filtered.slice(0, parseInt(limit, 10)), [filtered, limit]);

    const exportCsv = () => {
        const header = ['Rank','Student','GPA','ECTS'];
        const rows = filtered.map((s, i) => [i+1, s.name, s.gpa.toFixed(2), s.ects]);
        const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'performance_ranking.csv';
        a.click();
        URL.revokeObjectURL(url);
        guardedNotify('scholarships-export', 'success', 'Exported ranking CSV');
    };

    const closeAll = () => openDialog('');
    const householdOptions = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), []);
    const pad = 'py-2';

    return (
        <div className="space-y-6">
            <div className="bg-card glass-card rounded-lg border border-border p-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-border p-4">
                        <div className="text-sm text-muted-foreground">Merit Scholarship</div>
                        <div className="text-lg font-semibold mt-1">{eligibleMerit ? 'Eligible' : 'Not Eligible Yet'}</div>
                        <UL className="mt-3">
                            <li>Requirement: GPA ≥ 1.80 (scale 1–4)</li>
                            <li>Automatic consideration after semester close</li>
                            <li>Payout to bank account on file</li>
                        </UL>
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <Button size="sm" variant="outline" iconName="Info" onClick={() => openDialog('merit')}>Learn more</Button>
                            <Button
                                size="sm"
                                iconName="BellRing"
                                disabled={!eligibleMerit}
                                onClick={() => { guardedNotify('scholarships-notify-award','success','You will be notified when awarded'); openDialog('merit'); }}
                            >
                                Enable notifications
                            </Button>
                        </div>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                        <div className="text-sm text-muted-foreground">Need-Based Support</div>
                        <div className="text-lg font-semibold mt-1">Consultation First</div>
                        <UL className="mt-3">
                            <li>Short advisor consult to review options</li>
                            <li>Bring income proofs later if requested</li>
                            <li>Response typically within 7–14 days</li>
                        </UL>
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <Button size="sm" variant="outline" iconName="Info" onClick={() => openDialog('need')}>Learn more</Button>
                            <Button size="sm" iconName="Calendar" onClick={() => navigate('/help')}>View help</Button>
                        </div>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                        <div className="text-sm text-muted-foreground">Performance Bonus</div>
                        <div className="text-lg font-semibold mt-1">Projected</div>
                        <UL className="mt-3">
                            <li>Ranked among program peers</li>
                            <li>Based on ECTS & exam scores</li>
                            <li>No application needed</li>
                        </UL>
                        <div className="mt-3 flex items-center justify-end">
                            <Button size="sm" variant="outline" iconName="Trophy" onClick={() => openDialog('ranking')}>Check ranking</Button>
                        </div>
                    </div>
                </div>
            </div>

            {dialog === 'merit' && (
                <Dialog onClose={() => openDialog('')} title="Merit Scholarship — Details">
                    <div className="space-y-3 text-sm">
                        <p className="text-muted-foreground">Merit scholarship rewards high academic performance. Eligibility is recalculated after the semester closes.</p>
                        <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground">Your status</div>
                            <div className="mt-1 text-foreground font-medium">{eligibleMerit ? 'Eligible based on current GPA.' : 'Not eligible yet. Improve GPA to ≥ 1.80.'}</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-lg border border-border p-3">
                                <div className="text-xs text-muted-foreground">Threshold</div>
                                <div className="text-lg font-semibold">GPA ≥ 1.80</div>
                            </div>
                            <div className="rounded-lg border border-border p-3">
                                <div className="text-xs text-muted-foreground">Disbursement</div>
                                <div className="text-lg font-semibold">Bank transfer</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                            <Button size="sm" variant="outline" iconName="ExternalLink" onClick={() => window.open('about:blank', '_blank')}>Open regulations (PDF)</Button>
                        </div>
                    </div>
                </Dialog>
            )}

            {dialog === 'need' && (
                <Dialog onClose={() => openDialog('')} title="Need-Based Support — Quick Check">
                    <div className="space-y-4 text-sm">
                        <Alert variant="info" title="Quick estimator">This helps you decide if a consult makes sense now. It doesn’t collect documents or file an application.</Alert>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 z-stack of-visible">
                            <Input
                                label="Monthly household income (EUR)"
                                type="number"
                                min={0}
                                step="0.01"
                                value={needInput.incomeMonthly}
                                onChange={(e)=>setNeedInput({ ...needInput, incomeMonthly: e.target.value })}
                                placeholder="e.g. 1200"
                            />
                            <div className="relative z-dropdown of-visible">
                                <label className="block text-xs text-muted-foreground mb-1">Household size</label>
                                <Select options={householdOptions} value={needInput.household} onChange={(v)=>setNeedInput({ ...needInput, household: asString(v) })} className="w-full [&>button]:w-full transition-all duration-200 relative z-dropdown of-visible" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-lg border border-border p-3">
                                <div className="text-xs text-muted-foreground">Estimated per-capita income</div>
                                <div className="text-lg font-semibold">{perCapita ? `${perCapita.toFixed(2)} €` : '—'}</div>
                            </div>
                            {perCapita ? (
                                <Alert variant={likelyEligible ? 'success' : 'info'} title={likelyEligible ? 'Consult recommended' : 'Consult optional'}>
                                    {likelyEligible ? 'Based on your estimate, a short advisor consult is likely worth it.' : 'You can still book a consult if you have special circumstances.'}
                                </Alert>
                            ) : (
                                <Alert variant="info" title="Enter numbers">Fill in income and household size to see the recommendation.</Alert>
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <Button size="sm" variant="outline" iconName="ExternalLink" onClick={() => window.open('about:blank','_blank')}>Read policy</Button>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    iconName="Copy"
                                onClick={() => navigator.clipboard.writeText(`Income/month: ${needInput.incomeMonthly || '-'}\nHousehold: ${needInput.household}\nPer-capita: ${perCapita || '-'}`)
                                        .then(()=>guardedNotify('scholarships-copy-need','success','Summary copied'))
                                        .catch(()=>notify('error','Copy failed'))
                                    }
                                >
                                    Copy summary
                                </Button>
                                <Button size="sm" iconName="Calendar" onClick={() => navigate('/help')}>Book consultation</Button>
                            </div>
                        </div>
                    </div>
                </Dialog>
            )}

            {dialog === 'ranking' && (
                <Dialog onClose={closeAll} title="Performance Ranking (Projected)">
                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Icon name="Loader2" className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-muted-foreground">Loading ranking...</span>
                            </div>
                        ) : population.length === 0 ? (
                            <Alert variant="info" title="No ranking data">
                                Ranking data is not yet available. Rankings are calculated after grades are recorded.
                            </Alert>
                        ) : (
                            <>
                        <div className="rounded-lg border border-border p-3 flex items-center justify-between">
                            <div className="text-sm"><span className="font-semibold">Your position:</span> {Math.max(1, filtered.findIndex(s => s.name === 'You') + 1)} / {rankingData.total || filtered.length}</div>
                            <div className="text-xs text-muted-foreground">Percentile {percentile}%</div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 z-stack of-visible">
                            <Select options={[{value:'gpa',label:'Sort: GPA'},{value:'ects',label:'Sort: ECTS'}]} value={sortBy} onChange={(v)=>setSortBy(asString(v))} className="w-full [&>button]:w-full relative z-dropdown of-visible" />
                            <Select options={[{value:'10',label:'Show 10'},{value:'25',label:'Show 25'},{value:String(filtered.length),label:'Show All'}]} value={limit} onChange={(v)=>setLimit(asString(v))} className="w-full [&>button]:w-full relative z-dropdown of-visible" />
                            <Input placeholder="Search name…" value={q} onChange={(e)=>setQ(e.target.value)} />
                        </div>
                        <div className="rounded-lg border border-border">
                            <div className="max-h-[50vh] overflow-y-auto overflow-x-auto thin-scrollbar">
                                <table className="text-sm min-w-[600px] w-full">
                                    <thead className="sticky top-0 bg-card/90 backdrop-blur border-b border-border z-10">
                                    <tr className="text-left">
                                        <th className={`${pad} px-3 w-10`}>#</th>
                                        <th className={`${pad} px-3`}>Student</th>
                                        <th className={`${pad} px-3`}>GPA</th>
                                        <th className={`${pad} px-3`}>ECTS</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {limited.map((s, i) => {
                                        const rankNo = filtered.findIndex(x => x.name === s.name) + 1;
                                        const isMe = s.name === 'You';
                                        return (
                                            <tr key={`${s.name}-${i}`} className={`border-b border-border ${isMe ? 'bg-primary/10' : ''}`}>
                                                <td className={`${pad} px-3`}>{rankNo}</td>
                                                <td className={`${pad} px-3`}>{s.name}</td>
                                                <td className={`${pad} px-3`}>{s.gpa.toFixed(2)}</td>
                                                <td className={`${pad} px-3`}>{s.ects}</td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="outline"
                                iconName="Copy"
                                onClick={() => navigator.clipboard.writeText(`Position: ${Math.max(1, filtered.findIndex(s => s.name === 'You') + 1)}/${rankingData.total || filtered.length} • Percentile: ${percentile}%`)
                                    .then(()=>guardedNotify('scholarships-copy-ranking','success','Summary copied'))
                                    .catch(()=>notify('error','Copy failed'))
                                }
                            >
                                Copy summary
                            </Button>
                            <Button variant="outline" iconName="Download" onClick={exportCsv}>Export CSV</Button>
                        </div>
                            </>
                        )}
                    </div>
                </Dialog>
            )}
        </div>
    );
}