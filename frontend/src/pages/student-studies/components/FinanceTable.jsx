// src/pages/student-studies/components/FinanceTable.jsx
import React from 'react';
import { ScrollX } from './Primitives';

export default function FinanceTable({ rows }) {
    return (
        <ScrollX className="thin-scrollbar">
            <table className="w-full text-sm">
                <thead className="text-left">
                <tr className="border-b border-border">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Variable Symbol</th>
                    <th className="py-2 pr-3">Specific Symbol</th>
                    <th className="py-2 pr-3">Constant Symbol</th>
                    <th className="py-2">Status</th>
                </tr>
                </thead>
                <tbody>
                {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border">
                        <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                        <td className="py-2 pr-3">{r.type}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{r.amount.toFixed(2)} {r.currency}</td>
                        <td className="py-2 pr-3">{r.variableSymbol}</td>
                        <td className="py-2 pr-3">{r.specificSymbol}</td>
                        <td className="py-2 pr-3">{r.constantSymbol}</td>
                        <td className="py-2"><span className="text-xs text-muted-foreground">{r.status}</span></td>
                    </tr>
                ))}
                </tbody>
            </table>
        </ScrollX>
    );
}