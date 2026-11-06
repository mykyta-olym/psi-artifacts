// src/pages/student-studies/components/FinancingView.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToasts } from '../../../components/ui/Toasts';
import SectionHeader from './SectionHeader';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import TabBar from '../../../components/ui/TabBar';
import FinanceTable from './FinanceTable';
import { fetchStudentVariableSymbols, fetchStudentBankConnections, fetchStudentPayments } from '../../../data/maisApiAdapter';

export default function FinancingView({ finance, studentId }) {
    const { notify } = useToasts();
    const toastStamp = useRef(0);
    const [tab, setTab] = useState('posted');
    
    // Fetch real data from API
    const [variableSymbols, setVariableSymbols] = useState([]);
    const [bankConnections, setBankConnections] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        if (!studentId) return;
        const load = async () => {
            setLoading(true);
            try {
                const [symbols, banks, paymentsData] = await Promise.all([
                    fetchStudentVariableSymbols(studentId),
                    fetchStudentBankConnections(studentId),
                    fetchStudentPayments(studentId)
                ]);
                setVariableSymbols(symbols || []);
                setBankConnections(banks || []);
                setPayments(paymentsData || []);
            } catch (e) {
                console.error('Failed to load financing data:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [studentId]);
    
    // Transform payments to table format
    const formattedPayments = useMemo(() => {
        return payments.map(p => ({
            id: p.id,
            date: p.postedDate || p.dueDate || p.createdAt?.split('T')[0],
            purpose: p.description || p.type || 'Payment',
            amount: p.amount,
            currency: p.currency || 'EUR',
            status: p.status === 'posted' ? 'Posted' : p.status === 'pending' ? 'Pending' : p.status,
            variableSymbol: p.variableSymbol,
            academicYear: p.academicYear,
            semester: p.semester
        }));
    }, [payments]);
    
    // Use real data if available, fallback to props
    const variableSymbol = useMemo(() => {
        const active = variableSymbols.find(s => s.isActive);
        return active?.symbol || finance.variableSymbol;
    }, [variableSymbols, finance.variableSymbol]);
    
    const specificSymbol = finance.specificSymbol;
    
    // Group symbols by purpose for display
    const symbolsByPurpose = useMemo(() => {
        const grouped = { tuition: null, dormitory: null, other: null };
        variableSymbols.forEach(s => {
            const purpose = String(s.purpose || '').toLowerCase();
            if (purpose.includes('tuition') || purpose.includes('školné')) {
                grouped.tuition = s;
            } else if (purpose.includes('dorm') || purpose.includes('ubytov')) {
                grouped.dormitory = s;
            } else {
                grouped.other = s;
            }
        });
        return grouped;
    }, [variableSymbols]);
    
    // Calculate totals from real payments data
    const totalDue = useMemo(() => {
        const displayPayments = formattedPayments.length > 0 ? formattedPayments : finance.payments;
        const posted = displayPayments.filter((p) => p.status === 'Posted' || p.status === 'posted').reduce((s, p) => s + p.amount, 0);
        const pending = displayPayments.filter((p) => p.status === 'Pending' || p.status === 'pending').reduce((s, p) => s + p.amount, 0);
        return { posted, pending, total: posted + pending };
    }, [formattedPayments, finance.payments]);
    
    // Use real payments if available, otherwise fallback
    const displayPayments = formattedPayments.length > 0 ? formattedPayments : finance.payments;

    return (
        <div className="space-y-6">
            <SectionHeader
                icon="Wallet"
                title="Study Financing"
                subtitle="Payments, symbols, and references for bank transfers"
                right={
                    <TabBar
                        value={tab}
                        onChange={setTab}
                        items={[
                            { value: 'posted', label: 'Posted Payments', icon: 'Receipt' },
                            { value: 'symbols', label: 'Specific Symbols', icon: 'Hash' },
                            { value: 'variables', label: 'Variable Symbols', icon: 'Hash' },
                        ]}
                        className="gap-2"
                    />
                }
            />
            {tab === 'posted' && (
                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Icon name="Receipt" size={16} className="text-primary" />
                            <h3 className="font-semibold text-foreground">Posted Payments</h3>
                        </div>
                        <div className="text-sm text-muted-foreground">Total {totalDue.total.toFixed(2)} EUR • Pending {totalDue.pending.toFixed(2)} EUR</div>
                    </div>
                    <FinanceTable rows={displayPayments} loading={loading} />
                </div>
            )}
            {tab === 'symbols' && (
                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <div className="mb-4">
                        <div className="flex items-center gap-2">
                            <Icon name="Hash" size={16} className="text-primary" />
                            <h3 className="font-semibold text-foreground">Overview of Specific Symbols</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Specific symbol identifies the purpose of your payment.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Tuition Fees</div>
                            <div className="text-lg font-semibold">{finance.specificSymbol}</div>
                            <div className="text-xs text-muted-foreground mt-1">Use for tuition and enrollment payments</div>
                        </div>
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Dormitory</div>
                            <div className="text-lg font-semibold">{String(Number(finance.specificSymbol) + 1)}</div>
                            <div className="text-xs text-muted-foreground mt-1">Use for accommodation fees</div>
                        </div>
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Library & Misc</div>
                            <div className="text-lg font-semibold">{String(Number(finance.specificSymbol) + 2)}</div>
                            <div className="text-xs text-muted-foreground mt-1">Use for penalties and other fees</div>
                        </div>
                    </div>
                </div>
            )}
            {tab === 'variables' && (
                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <div className="mb-4">
                        <div className="flex items-center gap-2">
                            <Icon name="Hash" size={16} className="text-primary" />
                            <h3 className="font-semibold text-foreground">Variable Symbols</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Variable symbol identifies you as the payer in all transfers.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Your Variable Symbol</div>
                            <div className="text-xl font-bold tracking-wider">{variableSymbol}</div>
                            <div className="text-xs text-muted-foreground mt-1">Use this for any university-related payment</div>
                            {variableSymbols.length > 0 && (
                                <div className="mt-2 text-xs text-green-600">✓ Loaded from university records</div>
                            )}
                        </div>
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm">Bank Transfer Template</div>
                            <div className="text-sm mt-2 space-y-1">
                                <div>Recipient: TUKE</div>
                                <div>IBAN: SK00 0000 0000 0000 0000 0000</div>
                                <div>Variable: {variableSymbol}</div>
                                <div>Specific: {specificSymbol}</div>
                                <div>Constant: 0308</div>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <Button
                                    size="sm"
                                    iconName="Copy"
                                    onClick={() => navigator.clipboard.writeText(`Recipient: TUKE\nIBAN: SK00 0000 0000 0000 0000 0000\nVariable: ${variableSymbol}\nSpecific: ${specificSymbol}\nConstant: 0308`)
                                        .then(()=>{
                                            const now = Date.now();
                                            if (now - toastStamp.current > 2400) {
                                                toastStamp.current = now;
                                                notify('success','Payment details copied');
                                            }
                                        })
                                        .catch(()=>notify('error','Copy failed'))
                                    }
                                >
                                    Copy Details
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}