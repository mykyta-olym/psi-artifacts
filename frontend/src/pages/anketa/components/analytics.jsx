// src/pages/anketa/parts/analytics.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import Reveal from '../../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../../constants/animations';
import { Pill, Metric } from './ui';
import { pct, median, stddev } from '../utils/utils';
import { ChartCard, BarChart } from './charts';

export default function AnalyticsBlock({ survey, responses = [], anchorId }) {

    // Statistics for each question
    const qStats = useMemo(() => {
        const stats = {};
        (survey?.questions || []).forEach(q => {
            const vals = responses.map(r => r.answers[q.id]).filter(v => v !== undefined && v !== null && v !== '');
            
            if (q.type === 'likert5' || q.type === 'stars5') {
                // Rating questions (1-5)
                const nums = vals.map(v => Number(v)).filter(n => Number.isFinite(n) && n >= 1 && n <= 5);
                const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                nums.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
                const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
                const med = median(nums);
                const sd = stddev(nums);
                const positive = nums.filter(x => x >= 4).length;
                stats[q.id] = { 
                    kind: 'rating', 
                    avg, 
                    count: nums.length, 
                    counts, 
                    median: med, 
                    std: sd, 
                    positivePct: pct(positive, nums.length) 
                };
            } else if (q.type === 'yesno') {
                // Yes/No questions
                const yes = vals.filter(v => String(v).toLowerCase() === 'yes').length;
                const no = vals.filter(v => String(v).toLowerCase() === 'no').length;
                stats[q.id] = { kind: 'yesno', yes, no, total: yes + no };
            } else if (q.type === 'multichoice') {
                // Multiple choice
                const all = {};
                vals.forEach(arr => { 
                    (Array.isArray(arr) ? arr : [arr]).forEach(x => { 
                        all[x] = (all[x] || 0) + 1; 
                    }); 
                });
                stats[q.id] = { kind: 'multi', counts: all, total: responses.length };
            } else {
                // Text questions
                stats[q.id] = { 
                    kind: 'text', 
                    count: vals.filter(v => String(v).trim().length > 0).length, 
                    total: responses.length 
                };
            }
        });
        return stats;
    }, [survey, responses]);

    // If no survey selected
    if (!survey) {
        return (
            <div id={anchorId} className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                Select a survey to view analytics
            </div>
        );
    }

    if (responses.length === 0) {
        return (
            <div id={anchorId} className="rounded-lg border border-dashed border-border bg-card/70 p-6 text-sm text-muted-foreground space-y-2">
                <div className="text-sm font-medium text-foreground">No responses yet</div>
                <p>
                    No responses have been received for <span className="font-semibold">{survey.title}</span>.
                </p>
                <p className="text-xs">Tip: Share the survey link with students to collect responses.</p>
            </div>
        );
    }

    return (
        <div id={anchorId} className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm font-medium mb-2">{survey.title}</div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                    <div>Total questions: <span className="font-medium text-foreground">{survey.questions?.length || 0}</span></div>
                    <div>Total responses: <span className="font-medium text-foreground">{responses.length}</span></div>
                </div>
            </div>

            {(survey?.questions || []).map((q, idx) => {
                const s = qStats[q.id] || {};
                
                // Chart data depending on question type
                let chartData = [];
                let chartTitle = '';
                
                if (s.kind === 'rating') {
                    // Rating 1-5: show response count for each rating
                    chartData = [1, 2, 3, 4, 5].map(n => ({
                        name: `★ ${n}`,
                        value: s.counts?.[n] || 0
                    }));
                    chartTitle = 'Rating Distribution';
                } else if (s.kind === 'yesno') {
                    // Yes/No: show counts
                    chartData = [
                        { name: 'Yes', value: s.yes || 0 },
                        { name: 'No', value: s.no || 0 }
                    ];
                    chartTitle = 'Response Distribution';
                } else if (s.kind === 'multi') {
                    // Multiple choice: top options
                    chartData = Object.entries(s.counts || {})
                        .sort((a, b) => b[1] - a[1])
                        .map(([opt, cnt]) => ({
                            name: opt.length > 20 ? opt.slice(0, 20) + '...' : opt,
                            value: cnt
                        }));
                    chartTitle = 'Choice Distribution';
                } else if (s.kind === 'text') {
                    // Text: show filled/skipped
                    chartData = [
                        { name: 'Filled', value: s.count || 0 },
                        { name: 'Skipped', value: (s.total || 0) - (s.count || 0) }
                    ];
                    chartTitle = 'Completion Rate';
                }

                return (
                    <Reveal
                        key={q.id}
                        as={motion.div}
                        delay={ANIMATION_DELAYS.MAIN_CONTENT + idx * ANIMATION_DELAYS.STEP}
                        variant="keycap"
                        waitForLoaders={true}
                        className="rounded-lg border border-border p-4 bg-card space-y-4"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="min-w-0 text-sm font-medium leading-5">
                                {idx + 1}. {q.text}
                            </div>
                            <Pill intent="gray">{q.type}</Pill>
                        </div>

                        {/* Chart for the question */}
                        {chartData.length > 0 && (
                            <div className="grid grid-cols-1 gap-4">
                                <ChartCard 
                                    title={chartTitle} 
                                    data={chartData} 
                                    filename={`${survey.title}-Q${idx + 1}`}
                                >
                                    <BarChart data={chartData} title={chartTitle} />
                                </ChartCard>
                            </div>
                        )}

                        {/* Metrics for rating questions */}
                        {s.kind === 'rating' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <Metric label="Responses" value={s.count || 0} />
                                <Metric label="Average" value={Number(s.avg || 0).toFixed(2)} />
                                <Metric label="Median" value={Number(s.median || 0).toFixed(1)} />
                                <Metric label="Positive (≥4)" value={`${s.positivePct || 0}%`} />
                            </div>
                        )}

                        {/* Metrics for Yes/No questions */}
                        {s.kind === 'yesno' && (
                            <div className="grid grid-cols-3 gap-3">
                                <Metric label="Total" value={s.total || 0} />
                                <Metric label="Yes" value={s.yes || 0} />
                                <Metric label="No" value={s.no || 0} />
                            </div>
                        )}

                        {/* Metrics for multiple choice questions */}
                        {s.kind === 'multi' && (
                            <div className="grid grid-cols-2 gap-3">
                                <Metric label="Total responses" value={s.total || 0} />
                                <Metric label="Unique choices" value={Object.keys(s.counts || {}).length} />
                            </div>
                        )}

                        {/* Metrics for text questions */}
                        {s.kind === 'text' && (
                            <div className="grid grid-cols-2 gap-3">
                                <Metric label="Filled" value={s.count || 0} />
                                <Metric label="Total" value={s.total || 0} />
                            </div>
                        )}
                    </Reveal>
                );
            })}
        </div>
    );
}
