import React from 'react';
import Button from '../../../components/ui/Button';
import PerPageDropup from './PerPageDropup';

const Pagination = ({ page, totalPages, total, start, count, perPage, setPage, setPerPage }) => {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages} • Showing {total ? (start + 1) : 0}–{Math.min(total, start + count)} of {total}
            </div>
            <div className="flex items-center gap-2 flex-nowrap">
                <PerPageDropup
                    value={String(perPage)}
                    onChange={(v)=>{ setPerPage(Number(v)); setPage(1); }}
                    options={[
                        {value:'10',label:'10 / page'},
                        {value:'20',label:'20 / page'},
                        {value:'50',label:'50 / page'},
                    ]}
                />
                <Button
                    variant="outline"
                    size="sm"
                    iconName="ChevronLeft"
                    iconPosition="left"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-9 whitespace-nowrap"
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    iconName="ChevronRight"
                    iconPosition="right"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-9 whitespace-nowrap"
                >
                    Next
                </Button>
            </div>
        </div>
    );
};

export default Pagination;