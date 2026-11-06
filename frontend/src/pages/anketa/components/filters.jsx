// src/pages/anketa/parts/filters.jsx
import React from 'react';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';

export default function FiltersBarStudent({ filters, setFilters }) {
    return (
        <div className="bg-card glass-card rounded-lg border border-border p-3 z-stack of-visible">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative z-dropdown of-visible">
                    <Select
                        label="Category"
                        options={[
                            { value:'all', label:'All categories' },
                            { value:'course', label:'Course' },
                            { value:'teacher', label:'Teacher' },
                            { value:'service', label:'Service' },
                        ]}
                        value={filters.category}
                        onChange={(v)=>{ const nv = typeof v === 'string' ? v : v?.value; setFilters({ ...filters, category: String(nv || 'all') }); }}
                    />
                </div>
                <div className="relative z-dropdown of-visible">
                    <Select
                        label="Status"
                        options={[
                            { value:'all', label:'All statuses' },
                            { value:'open', label:'Open' },
                            { value:'submitted', label:'Submitted' },
                            { value:'closed', label:'Closed' },
                        ]}
                        value={filters.status}
                        onChange={(v)=>{ const nv = typeof v === 'string' ? v : v?.value; setFilters({ ...filters, status: String(nv || 'all') }); }}
                    />
                </div>
                <div>
                    <Input
                        label="Search"
                        placeholder="Search title, course, teacher…"
                        value={filters.search}
                        onChange={(e)=>setFilters({ ...filters, search: e?.target?.value || '' })}
                    />
                </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="outline" iconName="RefreshCw" onClick={()=>setFilters({ category:'all', status:'all', search:'' })}>Reset</Button>
            </div>
        </div>
    );
}