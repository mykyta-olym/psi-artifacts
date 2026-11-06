// src/pages/anketa/parts/charts.jsx
import React, { useCallback, useRef } from 'react';
import { BarChart as RechartsBar, Bar, LineChart as RechartsLine, Line, RadialBarChart, RadialBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import Button from '../../../components/ui/Button';
import { useToasts } from '../../../components/ui/Toasts';
import { dataToCSV, toSlug, exportNodeAsPNG, exportNodeAsSVG, copyNodeAsPNG } from '../utils/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const ChartCard = ({ title, subtitle, data, filename, children, rightExtras=null }) => {
    const ref = useRef(null);
    const { notify } = useToasts();
    const toastLocks = useRef({});
    const guardedNotify = useCallback((key, payload) => {
        const now = Date.now();
        const lock = payload.lockMs ?? 2400;
        if (now - (toastLocks.current[key] ?? 0) < lock) return;
        toastLocks.current[key] = now;
        notify(payload.type, payload.message, payload);
    }, [notify]);
    const onPNG = async () => {
        await exportNodeAsPNG(ref.current, filename || title || 'chart');
        guardedNotify('chart-export-png', { type: 'success', message: 'PNG exported', title: 'Export' });
    };
    const onSVG = () => {
        exportNodeAsSVG(ref.current, filename || title || 'chart');
        guardedNotify('chart-export-svg', { type: 'success', message: 'SVG exported', title: 'Export' });
    };
    const onCSV = () => {
        const blob = new Blob([dataToCSV(data)], { type:'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${toSlug(filename || title || 'chart')}.csv`; a.click();
        setTimeout(()=>URL.revokeObjectURL(url), 300);
        guardedNotify('chart-export-csv', { type: 'success', message: 'CSV exported', title: 'Export' });
    };
    const onCopy = async () => {
        const res = await copyNodeAsPNG(ref.current);
        if (res?.ok) guardedNotify('chart-copy-success', { type: 'success', message: 'Chart image copied to clipboard', title: 'Copy' });
        else if (res?.reason==='clipboard-unsupported') guardedNotify('chart-copy-unsupported', { type: 'warning', message: 'Clipboard not supported', title: 'Copy', lockMs: 4000 });
        else if (res?.reason==='no-node') notify('error','No chart found',{title:'Copy'});
        else notify('error','Failed to copy image',{title:'Copy'});
    };

    return (
        <div className="rounded-lg border border-border p-3 bg-card">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{title}</div>
                    {subtitle ? <div className="text-xs text-muted-foreground truncate">{subtitle}</div> : null}
                </div>
                <div className="flex items-center gap-1">
                    {rightExtras}
                    <Button size="xs" variant="outline" iconName="Download" onClick={onPNG}>PNG</Button>
                    <Button size="xs" variant="outline" iconName="Download" onClick={onSVG}>SVG</Button>
                    <Button size="xs" variant="outline" iconName="FileText" onClick={onCSV}>CSV</Button>
                    <Button size="xs" variant="outline" iconName="Copy" onClick={onCopy}>Copy</Button>
                </div>
            </div>
            <div ref={ref} className="rounded-md bg-background/40 p-2">
                {children}
            </div>
        </div>
    );
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
            <p className="text-xs font-medium mb-1">{label}</p>
            {payload.map((entry, index) => (
                <p key={index} className="text-xs" style={{ color: entry.color }}>
                    {entry.name}: {entry.value}
                </p>
            ))}
        </div>
    );
};

export const LineChart = ({ data, title, dataKey = 'value' }) => {
    // Microsoft-style: show actual values, auto-scale Y axis
    const normalizedData = data.map(item => ({
        name: item.name || item.date || '',
        value: item.value !== undefined ? item.value : item.attendanceRate || 0
    }));
    
    const maxValue = Math.max(...normalizedData.map(d => d.value), 0);
    const yMax = maxValue > 0 ? Math.ceil(maxValue * 1.1) : 100;
    
    return (
        <ResponsiveContainer width="100%" height={200}>
            <RechartsLine data={normalizedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, yMax]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
            </RechartsLine>
        </ResponsiveContainer>
    );
};

export const BarChart = ({ data, title, dataKey = 'value' }) => {
    // Microsoft-style: show actual counts, auto-scale Y axis
    const normalizedData = data.map(item => ({
        name: item.name || item.date || '',
        value: item.value !== undefined ? item.value : (item.percentage !== undefined ? item.percentage : item.attendanceRate || 0)
    }));
    
    const maxValue = Math.max(...normalizedData.map(d => d.value), 0);
    const yMax = maxValue > 0 ? Math.ceil(maxValue * 1.1) : 100;
    
    return (
        <ResponsiveContainer width="100%" height={200}>
            <RechartsBar data={normalizedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, yMax]} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {normalizedData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Bar>
            </RechartsBar>
        </ResponsiveContainer>
    );
};

export const RadialChart = ({ data, title, unit = '' }) => {
    // Microsoft-style radial: show percentage with max 100
    const normalizedData = data.map(item => ({
        name: item.name || item.date || 'Value',
        value: item.value !== undefined ? item.value : item.attendanceRate || 0,
        fill: '#3b82f6'
    }));
    
    const displayValue = normalizedData[0]?.value || 0;
    
    return (
        <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart 
                innerRadius="30%" 
                outerRadius="100%" 
                data={normalizedData} 
                startAngle={90} 
                endAngle={-270}
            >
                <RadialBar
                    background
                    dataKey="value"
                    cornerRadius={10}
                    maxBarSize={10}
                />
                <Tooltip content={<CustomTooltip />} />
                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-2xl font-bold fill-foreground"
                >
                    {displayValue}{unit || '%'}
                </text>
            </RadialBarChart>
        </ResponsiveContainer>
    );
};