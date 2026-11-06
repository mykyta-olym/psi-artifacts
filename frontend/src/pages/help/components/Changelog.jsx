import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const ChangelogEditorModal = ({ isOpen, onClose, entry = null, onSave }) => {
    const isEdit = !!entry;
    const [formData, setFormData] = useState({
        version: entry?.version || '',
        date: entry?.date || new Date().toISOString().split('T')[0],
        title: entry?.title || '',
        points: entry?.points?.join('\n') || ''
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e?.preventDefault();
        setSaving(true);
        
        try {
            const payload = {
                ...formData,
                points: formData.points.split('\n').map(p => p.trim()).filter(p => p.length > 0),
                id: entry?.id || `cl-${Date.now()}`
            };
            
            await onSave(payload);
            onClose();
        } catch (error) {
            console.error('Failed to save changelog entry:', error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-6 pb-24 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-background/80 backdrop-blur-sm" onClick={onClose} />
                <div className="inline-block w-full max-w-[100vw] sm:max-w-2xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border">
                    <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border-b border-border sticky top-0 z-20 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Icon name={isEdit ? 'Edit' : 'Plus'} size={20} />
                                {isEdit ? 'Edit Changelog Entry' : 'Add Changelog Entry'}
                            </h3>
                            <Button size="sm" variant="ghost" iconName="X" onClick={onClose} aria-label="Close" />
                        </div>

                        {/* Content */}
                        <div className="px-4 sm:px-5 md:px-8 py-5 md:py-8 max-h-[68vh] sm:max-h-[66vh] overflow-y-auto thin-scrollbar">
                            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                                <div className="grid grid-cols-2 gap-4 md:gap-6">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Version <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        value={formData.version}
                                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                        placeholder="e.g., 2.0.5"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Date <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Title <span className="text-destructive">*</span>
                                </label>
                                <Input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g., New features and improvements"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Changes <span className="text-destructive">*</span>
                                    <span className="text-muted-foreground text-xs ml-2">(one per line)</span>
                                </label>
                                <textarea
                                    value={formData.points}
                                    onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                                    placeholder="Added Knowledge Base system&#10;Fixed navigation issues&#10;Improved performance"
                                    required
                                    rows={8}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm resize-y thin-scrollbar"
                                />
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="px-4 sm:px-6 md:px-8 py-3 md:py-5 border-t border-border bg-card sticky bottom-0 z-20 flex items-center justify-end gap-2">
                        <Button variant="ghost" onClick={onClose} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            iconName="Save"
                            onClick={handleSubmit}
                            disabled={saving || !formData.version.trim() || !formData.title.trim() || !formData.points.trim()}
                        >
                            {saving ? 'Saving...' : isEdit ? 'Update Entry' : 'Add Entry'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const Changelog = ({ anchorId, items = [], onAdd, onEdit, onDelete, isTeacher }) => {
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);

    const handleAdd = () => {
        setEditingEntry(null);
        setEditorOpen(true);
    };

    const handleEdit = (entry) => {
        setEditingEntry(entry);
        setEditorOpen(true);
    };

    const handleSave = async (payload) => {
        if (editingEntry) {
            await onEdit(payload);
        } else {
            await onAdd(payload);
        }
    };

    return (
        <>
            <section id={anchorId} className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Icon name="History" size={18}/>
                        <h2 className="text-lg font-semibold">Changelog</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Recent updates</span>
                        {isTeacher && (
                            <Button size="xs" variant="default" iconName="Plus" onClick={handleAdd}>
                                Add Entry
                            </Button>
                        )}
                    </div>
                </div>
                <div className="space-y-4">
                    {items.filter(item => item && item.id).map(item=>(
                        <div key={item.id} className="flex gap-3 group">
                            <div className="w-6 flex justify-center"><div className="w-2 h-2 rounded-full bg-primary mt-2"/></div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="text-sm font-semibold">{item.title}</div>
                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">{item.version}</span>
                                    <span className="text-xs text-muted-foreground">{item.date}</span>
                                    {isTeacher && (
                                        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button size="xs" variant="ghost" iconName="Edit" onClick={() => handleEdit(item)} />
                                            <Button size="xs" variant="ghost" iconName="Trash2" onClick={() => onDelete(item.id)} />
                                        </div>
                                    )}
                                </div>
                                <ul className="list-disc ml-5 text-sm mt-1 space-y-1">
                                    {(item.points || []).map((p,i)=><li key={i}>{p}</li>)}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <ChangelogEditorModal
                isOpen={editorOpen}
                onClose={() => {
                    setEditorOpen(false);
                    setEditingEntry(null);
                }}
                entry={editingEntry}
                onSave={handleSave}
            />
        </>
    );
};

export default Changelog;