// src/components/news/NewsModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import ModalBase from 'components/ui/ModalBase';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import Select from 'components/ui/Select';
import { Checkbox } from 'components/ui/Checkbox';
import Icon from 'components/AppIcon';
import { createNews, updateNews, uploadNewsFile, deleteNewsFile } from 'data/newsApi';

// Helper to get full URL for uploaded files
const getFileUrl = (url) => {
    if (!url) return '';
    // If already absolute URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Relative URLs starting with /uploads are proxied to backend
    return url;
};

const NewsModal = ({ isOpen, onClose, newsItem, onSuccess }) => {
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        contentHtml: '',
        category: '',
        coverImageUrl: '',
        priority: 0,
        isPublished: true,
        publishedAt: new Date().toISOString().slice(0, 16),
        expiresAt: '',
    });
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);

    useEffect(() => {
        if (newsItem) {
            setFormData({
                title: newsItem.title || '',
                content: newsItem.content || '',
                contentHtml: newsItem.contentHtml || '',
                category: newsItem.category || '',
                coverImageUrl: newsItem.coverImageUrl || '',
                priority: newsItem.priority || 0,
                isPublished: newsItem.isPublished !== false,
                publishedAt: newsItem.publishedAt ? new Date(newsItem.publishedAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
                expiresAt: newsItem.expiresAt ? new Date(newsItem.expiresAt).toISOString().slice(0, 16) : '',
            });
            
            try {
                const parsed = newsItem.attachments ? 
                    (typeof newsItem.attachments === 'string' ? JSON.parse(newsItem.attachments) : newsItem.attachments) 
                    : [];
                setAttachments(Array.isArray(parsed) ? parsed : []);
            } catch {
                setAttachments([]);
            }
        } else {
            setFormData({
                title: '',
                content: '',
                contentHtml: '',
                category: '',
                coverImageUrl: '',
                priority: 0,
                isPublished: true,
                publishedAt: new Date().toISOString().slice(0, 16),
                expiresAt: '',
            });
            setAttachments([]);
        }
    }, [newsItem, isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileUpload = async (file, isImage = false) => {
        try {
            setUploading(true);
            const result = await uploadNewsFile(file);
            
            if (isImage) {
                setFormData(prev => ({ ...prev, coverImageUrl: result.url }));
            } else {
                setAttachments(prev => [...prev, result]);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveAttachment = async (index) => {
        const attachment = attachments[index];
        try {
            if (attachment.url) {
                await deleteNewsFile(attachment.url);
            }
            setAttachments(prev => prev.filter((_, i) => i !== index));
        } catch (error) {
            console.error('Failed to delete file:', error);
        }
    };

    const handleRemoveCoverImage = async () => {
        if (formData.coverImageUrl) {
            try {
                await deleteNewsFile(formData.coverImageUrl);
            } catch (error) {
                console.error('Failed to delete cover image:', error);
            }
        }
        setFormData(prev => ({ ...prev, coverImageUrl: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.title.trim()) {
            alert('Please enter a title');
            return;
        }

        try {
            setSaving(true);
            
            const data = {
                ...formData,
                attachments: JSON.stringify(attachments),
                publishedAt: new Date(formData.publishedAt).toISOString(),
                expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
            };

            if (newsItem?.id) {
                await updateNews(newsItem.id, data);
            } else {
                await createNews(data);
            }

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Failed to save news:', error);
            alert('Failed to save news');
        } finally {
            setSaving(false);
        }
    };

    const categoryOptions = [
        { value: 'academic', label: 'Academic' },
        { value: 'accommodation', label: 'Accommodation' },
        { value: 'financial', label: 'Financial' },
        { value: 'legal', label: 'Legal' },
        { value: 'events', label: 'Events' },
        { value: 'general', label: 'General' },
    ];

    return (
        <ModalBase
            open={isOpen}
            onClose={onClose}
            title={newsItem ? 'Edit News' : 'Create News'}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="Enter news title"
                />

                <Select
                    label="Category"
                    options={categoryOptions}
                    value={formData.category}
                    onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                    placeholder="Select category"
                    clearable
                />

                <Textarea
                    label="Content"
                    name="content"
                    value={formData.content}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Enter news content (plain text)"
                />

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-foreground">
                                HTML Content (Optional)
                            </label>
                            {formData.contentHtml && (
                                <div className="flex rounded-md border border-border overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setShowPreview(false)}
                                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                                            !showPreview 
                                                ? 'bg-primary text-primary-foreground' 
                                                : 'bg-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <Icon name="Code" size={12} className="inline mr-1" />
                                        Editor
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowPreview(true)}
                                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                                            showPreview 
                                                ? 'bg-primary text-primary-foreground' 
                                                : 'bg-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <Icon name="Eye" size={12} className="inline mr-1" />
                                        Preview
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setFormData(prev => ({ 
                                        ...prev, 
                                        contentHtml: `<p>Your main announcement text goes here.</p>

<h3>📅 Important Dates</h3>
<ul>
  <li><strong>Registration:</strong> December 1-15, 2025</li>
  <li><strong>Deadline:</strong> December 20, 2025</li>
</ul>

<p>For more information, contact <a href="mailto:info@university.edu">info@university.edu</a></p>`
                                    }));
                                    setShowPreview(false);
                                }}
                            >
                                📝 Basic
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setFormData(prev => ({ 
                                        ...prev, 
                                        contentHtml: `<div class="space-y-4">
  <p class="text-lg font-medium">🎓 Academic Announcement</p>
  
  <p>Dear Students and Faculty,</p>
  
  <p>We are pleased to announce the following updates:</p>
  
  <div class="bg-primary/10 p-4 rounded-lg my-4">
    <h4 class="font-semibold mb-2">📌 Key Points</h4>
    <ul class="list-disc pl-5 space-y-1">
      <li>Point one with details</li>
      <li>Point two with more information</li>
      <li>Point three - action required</li>
    </ul>
  </div>
  
  <h3 class="font-semibold mt-4">📞 Contact Information</h3>
  <p>Email: <a href="mailto:dekanat@university.edu" class="text-primary underline">dekanat@university.edu</a><br>
  Phone: +421 55 602 2000</p>
  
  <p class="text-sm text-muted-foreground mt-4">Best regards,<br>Faculty Administration</p>
</div>`
                                    }));
                                    setShowPreview(false);
                                }}
                            >
                                🎓 Academic
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setFormData(prev => ({ 
                                        ...prev, 
                                        contentHtml: `<div class="space-y-3">
  <p class="text-lg">🎉 Event Announcement</p>
  
  <div class="border-l-4 border-primary pl-4 my-4">
    <p class="font-semibold">Event Name</p>
    <p class="text-sm text-muted-foreground">Brief description of the event</p>
  </div>
  
  <h4 class="font-semibold">📍 Details</h4>
  <table class="w-full text-sm">
    <tr><td class="py-1"><strong>Date:</strong></td><td>January 15, 2026</td></tr>
    <tr><td class="py-1"><strong>Time:</strong></td><td>10:00 - 14:00</td></tr>
    <tr><td class="py-1"><strong>Location:</strong></td><td>Main Auditorium, Building A</td></tr>
  </table>
  
  <p class="mt-4">
    <a href="#" class="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md">
      Register Now →
    </a>
  </p>
</div>`
                                    }));
                                    setShowPreview(false);
                                }}
                            >
                                🎉 Event
                            </Button>
                            {formData.contentHtml && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, contentHtml: '' }));
                                        setShowPreview(false);
                                    }}
                                    className="text-destructive"
                                >
                                    ✕ Clear
                                </Button>
                            )}
                        </div>
                    </div>
                    
                    {showPreview && formData.contentHtml ? (
                        <div 
                            className="min-h-[200px] max-h-[300px] overflow-auto p-4 border border-border rounded-md bg-background prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: formData.contentHtml }}
                        />
                    ) : (
                        <Textarea
                            name="contentHtml"
                            value={formData.contentHtml}
                            onChange={handleChange}
                            rows={8}
                            placeholder="<p>Your HTML content here...</p>"
                            className="font-mono text-sm"
                        />
                    )}
                    
                    <p className="mt-1 text-xs text-muted-foreground">
                        {showPreview 
                            ? 'This is how your content will appear to users.' 
                            : 'Use HTML tags for formatting. Supports: p, h1-h6, ul, ol, li, a, strong, em, div, table, etc.'
                        }
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Priority"
                        name="priority"
                        type="number"
                        value={formData.priority}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        hint="Higher priority appears first"
                    />

                    <div className="flex items-end pb-1">
                        <Checkbox
                            label="Published"
                            checked={formData.isPublished}
                            onChange={(e) => setFormData(prev => ({ ...prev, isPublished: e.target.checked }))}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Publish Date"
                        name="publishedAt"
                        type="datetime-local"
                        value={formData.publishedAt}
                        onChange={handleChange}
                    />

                    <Input
                        label="Expires At (Optional)"
                        name="expiresAt"
                        type="datetime-local"
                        value={formData.expiresAt}
                        onChange={handleChange}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Cover Image</label>
                    {formData.coverImageUrl ? (
                        <div className="relative">
                            <img 
                                src={getFileUrl(formData.coverImageUrl)} 
                                alt="Cover" 
                                className="w-full h-48 object-cover rounded-lg"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling?.classList?.remove('hidden');
                                }}
                            />
                            <div className="hidden w-full h-48 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                                <Icon name="ImageOff" size={32} />
                                <span className="ml-2">Failed to load image</span>
                            </div>
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={handleRemoveCoverImage}
                                className="absolute top-2 right-2"
                            >
                                <Icon name="X" size={16} />
                            </Button>
                        </div>
                    ) : (
                        <>
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], true)}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full h-32 border-dashed flex-col gap-2"
                            >
                                <Icon name="Image" size={32} className="text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {uploading ? 'Uploading...' : 'Click to upload cover image'}
                                </span>
                            </Button>
                        </>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Attachments</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        className="hidden"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full"
                        iconName="Paperclip"
                    >
                        {uploading ? 'Uploading...' : 'Add Attachment'}
                    </Button>

                    {attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {attachments.map((att, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 border border-border rounded-md bg-input/50">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Icon name="Paperclip" size={14} className="text-muted-foreground" />
                                        <span className="truncate">{att.fileName}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({(att.size / 1024).toFixed(1)} KB)
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveAttachment(idx)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Icon name="Trash2" size={14} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={saving || uploading}
                    >
                        {saving ? 'Saving...' : newsItem ? 'Update' : 'Create'}
                    </Button>
                </div>
            </form>
        </ModalBase>
    );
};

export default NewsModal;
