// ./pages/profile/components/BankAccountsPanel.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { Checkbox } from '../../../components/ui/Checkbox';
import { 
    fetchBankConnections, 
    addBankConnection, 
    updateBankConnection, 
    deleteBankConnection 
} from '../../../data/studentDataApi';

const emptyAcc = { bankName: '', accountNumber: '', iban: '', swift: '', isPrimary: false };

const BankAccountsPanel = ({ studentId, isEditing }) => {
    const [accounts, setAccounts] = useState([]);
    const [draftAcc, setDraftAcc] = useState(emptyAcc);
    const [showAdd, setShowAdd] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (studentId) loadBankConnections();
    }, [studentId]);

    const loadBankConnections = async () => {
        setLoading(true);
        const data = await fetchBankConnections(studentId);
        setAccounts(data || []);
        setLoading(false);
    };

    useEffect(() => {
        if (isEditing && accounts.length === 0) setShowAdd(true);
        if (!isEditing) setShowAdd(false);
    }, [isEditing, accounts.length]);

    const canAdd = useMemo(() => {
        return ['bankName', 'iban'].every(k => String(draftAcc[k] || '').trim());
    }, [draftAcc]);

    const add = async () => {
        if (!canAdd) return;
        const result = await addBankConnection(studentId, draftAcc);
        if (result) {
            await loadBankConnections();
            setDraftAcc(emptyAcc);
            setShowAdd(false);
        }
    };

    const remove = async (acc) => {
        const result = await deleteBankConnection(studentId, acc.id);
        if (result) {
            await loadBankConnections();
        }
    };

    const updateField = async (acc, key, val) => {
        const updated = { ...acc, [key]: val };
        await updateBankConnection(studentId, acc.id, { [key]: val });
        await loadBankConnections();
    };

    return (
        <section className="bg-card rounded-lg border border-border p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon name="Wallet" size={18} className="text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Bank Connections</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded border border-border bg-muted/40">{accounts.length} linked</span>
                    {isEditing && accounts.length > 0 && !showAdd && (
                        <Button size="xs" iconName="Plus" onClick={() => setShowAdd(true)}>Add</Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
            ) : accounts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No bank accounts linked.</div>
            ) : (
                <ul className="space-y-2">
                    {accounts.map((acc) => (
                        <li key={acc.id} className="rounded-md border border-border p-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Bank"
                                    value={acc.bankName || ''}
                                    onChange={(e) => updateField(acc, 'bankName', e.target.value)}
                                    disabled={!isEditing}
                                />
                                <Input
                                    label="Account Number"
                                    value={acc.accountNumber || ''}
                                    onChange={(e) => updateField(acc, 'accountNumber', e.target.value)}
                                    disabled={!isEditing}
                                />
                                <Input
                                    label="IBAN"
                                    value={acc.iban || ''}
                                    onChange={(e) => updateField(acc, 'iban', e.target.value)}
                                    disabled={!isEditing}
                                />
                                <Input
                                    label="SWIFT/BIC"
                                    value={acc.swift || ''}
                                    onChange={(e) => updateField(acc, 'swift', e.target.value)}
                                    disabled={!isEditing}
                                />
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={acc.isPrimary || false}
                                        onChange={(e) => updateField(acc, 'isPrimary', e.target.checked)}
                                        disabled={!isEditing}
                                        id={`primary-${acc.id}`}
                                    />
                                    <label htmlFor={`primary-${acc.id}`} className="text-sm text-muted-foreground cursor-pointer">
                                        Primary account
                                    </label>
                                </div>
                                <Button size="sm" variant="ghost" iconName="Trash2" onClick={() => remove(acc)} disabled={!isEditing}>
                                    Remove
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {isEditing && showAdd && (
                <div className="mt-4 rounded-md border border-dashed border-border p-3">
                    <div className="text-sm font-medium mb-2">Add Bank Account</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                            label="Bank"
                            value={draftAcc.bankName}
                            onChange={(e) => setDraftAcc({ ...draftAcc, bankName: e.target.value })}
                        />
                        <Input
                            label="Account Number"
                            value={draftAcc.accountNumber}
                            onChange={(e) => setDraftAcc({ ...draftAcc, accountNumber: e.target.value })}
                        />
                        <Input
                            label="IBAN"
                            value={draftAcc.iban}
                            onChange={(e) => setDraftAcc({ ...draftAcc, iban: e.target.value })}
                        />
                        <Input
                            label="SWIFT/BIC"
                            value={draftAcc.swift}
                            onChange={(e) => setDraftAcc({ ...draftAcc, swift: e.target.value })}
                        />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <Checkbox
                            checked={draftAcc.isPrimary || false}
                            onChange={(e) => setDraftAcc({ ...draftAcc, isPrimary: e.target.checked })}
                            id="primary-new"
                        />
                        <label htmlFor="primary-new" className="text-sm text-muted-foreground cursor-pointer">
                            Set as primary account
                        </label>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <Button size="sm" onClick={add} disabled={!canAdd} iconName="Plus">Add</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setDraftAcc(emptyAcc); }}>Cancel</Button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default BankAccountsPanel;