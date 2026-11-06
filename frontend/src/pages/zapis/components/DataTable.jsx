// src/pages/zapis/components/DataTable.jsx
import React from 'react';

const DataTable = ({ id, head, rows }) => {
    return (
        <div id={id} className="glass-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto thin-scrollbar">
                <table className="w-full table-auto text-sm">
                    <thead className="bg-muted/40 backdrop-blur supports-[backdrop-filter]:bg-muted/40 sticky top-0">
                    <tr>
                        {head.map((h) => (
                            <th key={h.key} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h.label}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={head.length}>No records</td>
                        </tr>
                    ) : (
                        rows.map((cells, i) => (
                            <tr key={cells.key || `${id}-${i}`} className="border-t border-border hover:bg-white/5">
                                {cells.cols.map((c, ci) => (
                                    <td key={`${cells.key || i}-${ci}`} className="px-3 py-2 align-top">{c}</td>
                                ))}
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DataTable;