import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
    'Getting Started',
    'Student Features',
    'Teacher Features',
    'Grades & Assessment',
    'Attendance',
    'Chat & Communication',
    'Resources',
    'Schedules',
    'Surveys',
    'Troubleshooting',
    'Advanced Topics',
    'General'
];

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

const ArticleEditorModal = ({ isOpen, onClose, article = null, onSave }) => {
    const isEdit = !!article;
    
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        category: 'General',
        tags: '',
        difficulty: 'Beginner',
        isPublished: true
    });
    
    const [saving, setSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    useEffect(() => {
        if (article) {
            setFormData({
                title: article.title || '',
                content: article.content || article.body || '',
                category: article.category || 'General',
                tags: Array.isArray(article.tags) ? article.tags.join(', ') : '',
                difficulty: article.difficulty || 'Beginner',
                isPublished: article.isPublished ?? true
            });
        } else {
            setFormData({
                title: '',
                content: '',
                category: 'General',
                tags: '',
                difficulty: 'Beginner',
                isPublished: true
            });
        }
    }, [article]);

    const handleSubmit = async (e) => {
        e?.preventDefault();
        setSaving(true);
        
        try {
            const tagsArray = formData.tags
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
            
            const payload = {
                title: formData.title,
                content: formData.content,
                category: formData.category,
                tags: tagsArray,
                difficulty: formData.difficulty,
                isPublished: formData.isPublished
            };
            
            await onSave(payload, article);
            onClose();
        } catch (error) {
            console.error('Failed to save article:', error);
        } finally {
            setSaving(false);
        }
    };

    const renderPreview = () => {
        return (
            <div className="prose prose-sm max-w-none">
                <h1>{formData.title || 'Untitled Article'}</h1>
                <div className="flex gap-2 mb-4 flex-wrap">
                    <span className="px-2 py-1 text-xs rounded bg-primary/10 border border-primary/20 text-primary">
                        {formData.category}
                    </span>
                    <span className="px-2 py-1 text-xs rounded bg-muted border border-border">
                        {formData.difficulty}
                    </span>
                    {formData.tags.split(',').filter(t => t.trim()).map((tag, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded bg-muted border border-border">
                            {tag.trim()}
                        </span>
                    ))}
                </div>
                <div className="whitespace-pre-wrap">{formData.content || 'No content yet...'}</div>
            </div>
        );
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-6 pb-24 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-background/80 backdrop-blur-sm" onClick={onClose} />
                <div className="inline-block w-full max-w-[100vw] sm:max-w-4xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border-b border-border sticky top-0 z-20 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                        <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
                            <Icon name={isEdit ? 'Edit' : 'Plus'} size={20} />
                            {isEdit ? 'Edit Article' : 'Create New Article'}
                        </h3>
                        <div className="flex items-center justify-between gap-2">
                            <Button
                                size="sm"
                                variant={previewMode ? 'default' : 'outline'}
                                iconName={previewMode ? 'Eye' : 'Code'}
                                onClick={() => setPreviewMode(!previewMode)}
                            >
                                {previewMode ? 'Preview' : 'Edit'}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                iconName="X"
                                onClick={onClose}
                                aria-label="Close"
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 sm:px-5 md:px-8 py-5 md:py-8 max-h-[68vh] sm:max-h-[66vh] overflow-y-auto thin-scrollbar">
                        {previewMode ? (
                            renderPreview()
                        ) : (
                                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Title <span className="text-destructive">*</span>
                                        </label>
                                        <Input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            placeholder="Enter article title"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Category</label>
                                            <Select
                                                value={formData.category}
                                                onChange={(value) => setFormData({ ...formData, category: value })}
                                                options={CATEGORIES.map(c => ({ value: c, label: c }))}
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Difficulty</label>
                                            <Select
                                                value={formData.difficulty}
                                                onChange={(value) => setFormData({ ...formData, difficulty: value })}
                                                options={DIFFICULTIES.map(d => ({ value: d, label: d }))}
                                            />
                                        </div>

                                        <div className="flex items-end">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isPublished}
                                                    onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                                                    className="rounded border-border"
                                                />
                                                <span className="text-sm">Published</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Tags <span className="text-muted-foreground text-xs">(comma-separated)</span>
                                        </label>
                                        <Input
                                            type="text"
                                            value={formData.tags}
                                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                            placeholder="e.g., grades, assessment, quick-start"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Content <span className="text-destructive">*</span>
                                        </label>
                                        <textarea
                                            value={formData.content}
                                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                            placeholder="Write your article content here... (Markdown supported)"
                                            required
                                            rows={16}
                                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm resize-y thin-scrollbar"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Tip: Use clear headings, bullet points, and examples. Keep it concise and actionable.
                                        </p>
                                    </div>
                                </form>
                            )}
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
                            disabled={saving || !formData.title.trim() || !formData.content.trim()}
                        >
                            {saving ? 'Saving...' : isEdit ? 'Update Article' : 'Create Article'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ArticleEditorModal;
