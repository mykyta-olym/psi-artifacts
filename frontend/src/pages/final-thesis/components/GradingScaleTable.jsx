// src/pages/final-thesis/components/GradingScaleTable.jsx
import React from 'react';

export default function GradingScaleTable() {
    const rows = [
        ['A - Výborne','100%','91%'],
        ['B - Veľmi dobre','90%','81%'],
        ['C - Dobre','80%','71%'],
        ['D - Uspokojivo','70%','61%'],
        ['E - Dostatočne','60%','51%'],
        ['FX - Nedostatočne','50%','0%'],
    ];
    return (
        <div className="bg-card glass-card rounded-lg border border-border p-0 overflow-hidden">
            <div className="px-4 py-3 text-sm font-medium flex items-center justify-between">
                <span>Prevodová tabuľka celkového hodnotenia</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="[&>th]:text-left [&>th]:py-2 [&>th]:px-4 text-muted-foreground border-t border-b border-border">
                        <th>Celkové hodnotenie</th>
                        <th>Horná hranica</th>
                        <th>Dolná hranica</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((r, i) => (
                        <tr key={String(i)} className="[&>td]:py-2 [&>td]:px-4 border-b border-border/60">
                            <td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}