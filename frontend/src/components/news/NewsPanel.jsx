// src/components/news/NewsPanel.jsx
import React, { useEffect, useState, useCallback } from 'react';
import Icon from 'components/AppIcon';
import { listNews } from 'data/newsApi';
import { useSignalR } from 'contexts/SignalRContext';

const NewsPanel = ({ onEdit, onCreate, canEdit = false, refreshTrigger = 0 }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedNews, setSelectedNews] = useState(null);
    const { subscribe, isConnected } = useSignalR();

    const loadNews = useCallback(async () => {
        try {
            setLoading(true);
            const response = await listNews({ published: true, pageSize: 5 });
            setNews(response?.items || []);
        } catch (error) {
            console.error('Failed to load news:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNews();
    }, [refreshTrigger, loadNews]);

    // Subscribe to SignalR updates for news
    useEffect(() => {
        if (!isConnected) return;

        const unsubscribe = subscribe('news-panel', (payload) => {
            if (payload?.type === 'news.updated') {
                console.log('[NewsPanel] News updated via SignalR:', payload);
                loadNews();
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isConnected, subscribe, loadNews]);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    const renderAttachments = (attachments) => {
        if (!attachments) return null;
        try {
            const parsed = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;
            if (!Array.isArray(parsed) || parsed.length === 0) return null;
            
            return (
                <div className="mt-3 space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">Attachments:</div>
                    {parsed.map((att, idx) => {
                        const isImage = att.extension && ['.jpg', '.jpeg', '.png', '.gif'].includes(att.extension.toLowerCase());
                        const isPdf = att.extension && att.extension.toLowerCase() === '.pdf';
                        
                        return (
                            <a
                                key={idx}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                <Icon 
                                    name={isImage ? 'Image' : isPdf ? 'FileText' : 'Paperclip'} 
                                    size={14} 
                                />
                                {att.fileName || 'Download'}
                            </a>
                        );
                    })}
                </div>
            );
        } catch {
            return null;
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Icon name="Newspaper" size={20} />
                        News & Announcements
                    </h3>
                </div>
                <div className="text-center py-8 text-muted-foreground text-sm">
                    Loading news...
                </div>
            </div>
        );
    }

    if (selectedNews) {
        const newsItem = news.find(n => n.id === selectedNews);
        if (!newsItem) {
            setSelectedNews(null);
            return null;
        }

        return (
            <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={() => setSelectedNews(null)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <Icon name="ArrowLeft" size={16} />
                        Back to news
                    </button>
                    {canEdit && onEdit && (
                        <button
                            onClick={() => onEdit(newsItem)}
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                            <Icon name="Pencil" size={14} />
                            Edit
                        </button>
                    )}
                </div>
                
                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">
                            {formatDate(newsItem.publishedAt)}
                        </div>
                        <h2 className="text-xl font-bold">{newsItem.title}</h2>
                        {newsItem.category && (
                            <span className="inline-block mt-2 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary">
                                {newsItem.category}
                            </span>
                        )}
                    </div>

                    {newsItem.coverImageUrl && (
                        <div className="rounded-lg overflow-hidden">
                            <img 
                                src={newsItem.coverImageUrl} 
                                alt={newsItem.title} 
                                className="w-full h-auto"
                            />
                        </div>
                    )}

                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        {newsItem.contentHtml ? (
                            <div dangerouslySetInnerHTML={{ __html: newsItem.contentHtml }} />
                        ) : (
                            <p className="whitespace-pre-wrap">{newsItem.content}</p>
                        )}
                    </div>

                    {renderAttachments(newsItem.attachments)}

                    {newsItem.authorName && (
                        <div className="text-xs text-muted-foreground pt-3 border-t">
                            Posted by {newsItem.authorName}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Icon name="Newspaper" size={20} />
                    News & Announcements
                </h3>
                {canEdit && onCreate && (
                    <button
                        onClick={onCreate}
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                        <Icon name="Plus" size={14} />
                        Add News
                    </button>
                )}
            </div>

            {news.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    No news available
                </div>
            ) : (
                <div className="space-y-2">
                    {news.map((item) => (
                        <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedNews(item.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedNews(item.id);
                                }
                            }}
                            className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm leading-snug line-clamp-2">
                                        {item.title}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {formatDate(item.publishedAt)}
                                    </div>
                                    {item.category && (
                                        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-primary/10 text-primary">
                                            {item.category}
                                        </span>
                                    )}
                                </div>
                                {canEdit && onEdit && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(item);
                                        }}
                                        className="flex-shrink-0 p-1 hover:bg-accent rounded"
                                    >
                                        <Icon name="Pencil" size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NewsPanel;
