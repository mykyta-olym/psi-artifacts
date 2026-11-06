import React, { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar,
    RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import Icon from '../../../components/AppIcon';

const AttendanceChart = ({ data = [], chartType = 'line', title, className = '' }) => {
    const VALUE_KEY = 'attendanceRate';

    const chartData = useMemo(
        () =>
            (Array.isArray(data) ? data : []).map(d => ({
                date: String(d?.date ?? ''),
                attendanceRate: Number(d?.[VALUE_KEY] ?? d?.value ?? 0)
            })),
        [data]
    );

    const stats = useMemo(() => {
        const vals = chartData.map(d => d.attendanceRate);
        if (!vals.length) return { avg: 0, max: 0, min: 0, latest: 0 };
        const sum = vals.reduce((a, b) => a + b, 0);
        return {
            avg: Math.round(sum / vals.length),
            max: Math.max(...vals),
            min: Math.min(...vals),
            latest: vals[vals.length - 1]
        };
    }, [chartData]);

    const formatYAxisTick = (value) => `${Number(value)}%`;

    const renderRadial = () => {
        const radialData = [{ name: 'Average', value: Number(stats.avg) }];
        return (
            <div className="w-full h-56 sm:h-64 md:h-72 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                        data={radialData}
                        innerRadius="68%"
                        outerRadius="100%"
                        startAngle={90}
                        endAngle={-270}
                    >
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar
                            dataKey="value"
                            minAngle={15}
                            clockWise
                            fill="var(--color-primary)"
                            background={{ fill: 'rgba(148,163,184,0.25)' }}
                            cornerRadius={8}
                            isAnimationActive
                        />
                        <Tooltip
                            labelFormatter={() => ''}
                            formatter={(val) => [`${Number(val)}%`, 'Average attendance']}
                            cursor={false}
                            contentStyle={{
                                backgroundColor: 'var(--color-popover)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '8px',
                                color: 'var(--color-popover-foreground)',
                                padding: 12
                            }}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-2xl sm:text-3xl font-bold text-foreground">{stats.avg}%</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Average attendance</div>
                </div>
            </div>
        );
    };

    const renderBar = () => (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickFormatter={formatYAxisTick}
                    domain={[0, 100]}
                />
                <Tooltip
                    formatter={(v) => [`${Number(v)}%`, 'Attendance']}
                    cursor={{ fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(255,255,255,0.8)', strokeWidth: 1 }}
                    contentStyle={{
                        backgroundColor: 'var(--color-popover)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        color: 'var(--color-popover-foreground)',
                        padding: 12
                    }}
                />
                <Bar dataKey={VALUE_KEY} fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );

    const renderLine = () => (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickFormatter={formatYAxisTick}
                    domain={[0, 100]}
                />
                <Tooltip
                    formatter={(v) => [`${Number(v)}%`, 'Attendance']}
                    cursor={{ stroke: 'rgba(255,255,255,0.85)', strokeWidth: 1 }}
                    contentStyle={{
                        backgroundColor: 'var(--color-popover)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        color: 'var(--color-popover-foreground)',
                        padding: 12
                    }}
                />
                <Line
                    type="monotone"
                    dataKey={VALUE_KEY}
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--color-primary)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: 'var(--color-primary)', strokeWidth: 2 }}
                    isAnimationActive
                />
            </LineChart>
        </ResponsiveContainer>
    );

    const renderChart = () => {
        if (chartType === 'radial') return renderRadial();
        if (chartType === 'bar') return renderBar();
        return renderLine();
    };

    return (
        <div className={`bg-card rounded-lg border border-border p-4 sm:p-6 ${className}`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
                <Icon
                    name={chartType === 'radial' ? 'PieChart' : chartType === 'bar' ? 'BarChart3' : 'TrendingUp'}
                    size={20}
                    className="text-primary"
                />
            </div>

            <div
                className={`w-full ${chartType === 'radial' ? 'h-56 sm:h-64 md:h-72' : 'h-56 sm:h-64 md:h-72 xl:h-80 2xl:h-96'}`}
                aria-label={`${title} Chart`}
            >
                {renderChart()}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="px-3 py-2 rounded-md border border-border bg-muted/30">
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Average</div>
                    <div className="font-semibold text-foreground">{stats.avg}%</div>
                </div>
                <div className="px-3 py-2 rounded-md border border-border bg-muted/30">
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Latest</div>
                    <div className="font-semibold text-foreground">{stats.latest}%</div>
                </div>
                <div className="px-3 py-2 rounded-md border border-border bg-muted/30 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">Range</div>
                        <div className="font-semibold text-foreground">{stats.min}% – {stats.max}%</div>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-primary ml-2" />
                </div>
            </div>
        </div>
    );
};

export default AttendanceChart;