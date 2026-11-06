import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import useUserPreference from '../../../hooks/useUserPreference';
import useDataUpdates from '../../../hooks/useDataUpdates';
import { 
    fetchKnowledgeBaseArticles, 
    fetchKnowledgeBaseCategories, 
    submitArticleFeedback,
    createKnowledgeBaseArticle,
    updateKnowledgeBaseArticle,
    deleteKnowledgeBaseArticle
} from '../../../data/knowledgeBaseApi';
import { useAuth } from '../../../contexts/AuthContext';
import Icon from '../../../components/AppIcon';
import { useToasts } from '../../../components/ui/Toasts';
import ArticleEditorModal from './ArticleEditorModal';
import apiClient from '../../../utils/apiClient';

const readTime = (text)=>`${Math.max(1, Math.round(String(text||'').trim().split(/\s+/).length/200))} min read`;
const highlightMatch = (s, q) => {
    const text = String(s||''); const query = String(q||'').trim(); if(!query) return text;
    try {
        const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'ig');
        return text.split(re).map((p,i)=> re.test(p) ? <mark key={i} className="px-0.5 rounded bg-yellow-200/50">{p}</mark> : <span key={i}>{p}</span>);
    } catch { return text; }
};

const KBItem = ({article, open, onToggle, pinned, onTogglePin, query, isTeacher, onEdit, onDelete}) => {
    const rt = readTime(article.body || article.content);
    const [showActions, setShowActions] = useState(false);
    const { notify } = useToasts();
    
    const handleFeedback = async (isHelpful) => {
        try {
            await submitArticleFeedback(article.originalId, isHelpful);
            notify('success', `Thank you for your feedback!`);
        } catch (error) {
            notify('error', 'Failed to submit feedback');
        }
    };
    
    return (
        <div className="border border-border rounded-lg p-3 sm:p-4 overflow-visible">
            <div className="flex items-start justify-between gap-2">
                <button
                    type="button"
                    className="text-left flex-1 min-w-0"
                    onClick={onToggle}
                    aria-expanded={open}
                    aria-controls={`kb-item-${article.id}`}
                >
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm sm:text-[15px] font-medium truncate max-w-full">
                            {highlightMatch(article.title, query)}
                        </div>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border whitespace-nowrap">{rt}</span>
                        {pinned && (
                            <span className="text-[11px] px-1 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary whitespace-nowrap">Pinned</span>
                        )}
                        {article.category && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent whitespace-nowrap">
                                {article.category}
                            </span>
                        )}
                        {article.difficulty && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted border border-border whitespace-nowrap">
                                {article.difficulty}
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2 sm:line-clamp-3">
                        {highlightMatch(article.summary || article.content?.substring(0, 200), query)}
                    </div>
                    <div className="mt-2 -mx-0.5">
                        <div className="flex gap-1.5 flex-wrap overflow-visible pr-1">
                            {(article.tags || []).map(t => (
                                <span
                                    key={t}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border flex-shrink-0 whitespace-nowrap"
                                    title={t}
                                >
                  {t}
                </span>
                            ))}
                        </div>
                    </div>
                </button>
                <div className="hidden sm:flex flex-col items-end gap-1 sm:gap-1 shrink-0">
                    <Button size="xs" variant="ghost" iconName={open ? 'ChevronUp' : 'ChevronDown'} onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'}/>
                    <Button size="xs" variant="ghost" iconName={pinned ? 'Star' : 'StarOff'} onClick={onTogglePin} aria-label={pinned ? 'Unpin' : 'Pin'}/>
                    {isTeacher && (
                        <div className="relative">
                            <Button 
                                size="xs" 
                                variant="ghost" 
                                iconName="MoreVertical" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowActions(!showActions);
                                }}
                                aria-label="More actions"
                            />
                            {showActions && (
                                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-xl z-[100] min-w-[120px] overflow-visible">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        iconName="Edit"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(article);
                                            setShowActions(false);
                                        }}
                                        className="w-full justify-start"
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        iconName="Trash2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(article);
                                            setShowActions(false);
                                        }}
                                        className="w-full justify-start text-destructive hover:text-destructive"
                                    >
                                        Delete
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-2 flex sm:hidden items-center gap-2">
                <Button size="xs" variant="ghost" iconName={open ? 'ChevronUp' : 'ChevronDown'} onClick={onToggle}>
                    {open ? 'Hide' : 'Show'}
                </Button>
                <Button size="xs" variant="ghost" iconName={pinned ? 'Star' : 'StarOff'} onClick={onTogglePin}>
                    {pinned ? 'Unpin' : 'Pin'}
                </Button>
                {isTeacher && (
                    <>
                        <Button size="xs" variant="ghost" iconName="Edit" onClick={() => onEdit(article)}>
                            Edit
                        </Button>
                        <Button size="xs" variant="ghost" iconName="Trash2" onClick={() => onDelete(article)}>
                            Delete
                        </Button>
                    </>
                )}
            </div>
            <div
                id={`kb-item-${article.id}`}
                className={`mt-2 text-sm text-muted-foreground break-words ${open ? '' : 'hidden'}`}
            >
                <div className="whitespace-pre-wrap">{article.body || article.content}</div>
                
                {/* Feedback section */}
                {open && (
                    <div className="mt-4 pt-4 border-t border-border flex items-center gap-4">
                        <span className="text-xs text-muted-foreground">Was this helpful?</span>
                        <div className="flex items-center gap-2">
                            <Button size="xs" variant="outline" iconName="ThumbsUp" onClick={() => handleFeedback(true)}>
                                Helpful {article.helpfulCount > 0 && `(${article.helpfulCount})`}
                            </Button>
                            <Button size="xs" variant="outline" iconName="ThumbsDown" onClick={() => handleFeedback(false)}>
                                Not helpful {article.notHelpfulCount > 0 && `(${article.notHelpfulCount})`}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const KB_PINS_PREF_KEY = 'help.kb.pins';
const KB_PER_PAGE_PREF_KEY = 'help.kb.perPage';

const useIsMobile = (q='(max-width: 480px)')=>{
    const [m, setM] = useState(()=> typeof window==='undefined' ? false : window.matchMedia(q).matches);
    useEffect(()=>{
        if (typeof window==='undefined' || !window.matchMedia) return;
        const mm = window.matchMedia(q);
        const fn = (e)=> setM(e.matches);
        mm.addEventListener?.('change', fn);
        return ()=> mm.removeEventListener?.('change', fn);
    },[q]);
    return m;
};

const KnowledgeBase = ({ anchorId, articles: staticArticles, query, userRole = 'student' }) => {
    const { user } = useAuth();
    const { notify } = useToasts();
    const isMobile = useIsMobile();
    const isTeacher = userRole === 'teacher';
    
    const [dbArticles, setDbArticles] = useState([]);
    const [categories, setCategories] = useState(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [loading, setLoading] = useState(true);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingArticle, setEditingArticle] = useState(null);
    
    // Load articles from database
    const loadArticles = useCallback(async () => {
        setLoading(true);
        try {
            const [articlesData, categoriesData] = await Promise.all([
                fetchKnowledgeBaseArticles(null, selectedCategory === 'All' ? null : selectedCategory),
                fetchKnowledgeBaseCategories()
            ]);
            
            // Transform DB articles to match expected format
            const transformed = articlesData.map(a => ({
                id: a.id.startsWith('kb-') ? a.id : `kb-${a.id}`,
                originalId: a.id, // Store original numeric ID
                title: a.title,
                tags: a.tags || [],
                summary: a.content?.substring(0, 200) + '...' || '',
                body: a.content,
                content: a.content,
                anchor: anchorId,
                category: a.category,
                difficulty: a.difficulty,
                viewCount: a.viewCount,
                helpfulCount: a.helpfulCount,
                notHelpfulCount: a.notHelpfulCount,
                authorEmail: a.authorEmail,
                isPublished: a.isPublished,
                createdAt: a.createdAt,
                updatedAt: a.updatedAt
            }));
            
            setDbArticles(transformed);
            setCategories(['All', ...categoriesData]);
        } catch (error) {
            console.error('Failed to load articles:', error);
            notify('error', 'Failed to load knowledge base articles');
            setDbArticles([]);
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, anchorId, notify]);
    
    useEffect(() => {
        loadArticles();
    }, [loadArticles]);
    
    // Subscribe to real-time knowledge base updates
    useDataUpdates(useCallback((payload) => {
        if (payload.type === 'knowledgebase.updated') {
            console.log('[KnowledgeBase] Article update received:', payload);
            // Trigger reload - fetch all data inline to avoid stale closure
            (async () => {
                try {
                    console.log('[KnowledgeBase] Invalidating cache...');
                    apiClient.invalidateCache('/knowledgebase');
                    // Fetch both articles and categories fresh
                    const [articlesData, categoriesData] = await Promise.all([
                        fetchKnowledgeBaseArticles(null, null), // Get all articles, filter will be applied by React state
                        fetchKnowledgeBaseCategories()
                    ]);
                    
                    const transformed = articlesData.map(a => ({
                        id: a.id.startsWith('kb-') ? a.id : `kb-${a.id}`,
                        originalId: a.id,
                        title: a.title,
                        tags: a.tags || [],
                        summary: a.content?.substring(0, 200) + '...' || '',
                        body: a.content,
                        content: a.content,
                        anchor: anchorId,
                        category: a.category,
                        difficulty: a.difficulty,
                        viewCount: a.viewCount,
                        helpfulCount: a.helpfulCount,
                        notHelpfulCount: a.notHelpfulCount,
                        authorEmail: a.authorEmail,
                        isPublished: a.isPublished,
                        createdAt: a.createdAt,
                        updatedAt: a.updatedAt
                    }));
                    
                    setDbArticles(transformed);
                    setCategories(['All', ...categoriesData]);
                    console.log('[KnowledgeBase] Articles reloaded:', transformed.length);
                } catch (error) {
                    console.error('Failed to reload articles after update:', error);
                }
            })();
        }
    }, [])); // Empty dependencies - anchorId used inline is from props/state
    
    // Combine static and DB articles
    const articles = useMemo(() => {
        return [...(staticArticles || []), ...dbArticles];
    }, [staticArticles, dbArticles]);
    
    const handleCreateArticle = () => {
        setEditingArticle(null);
        setEditorOpen(true);
    };
    
    const handleEditArticle = (article) => {
        setEditingArticle(article);
        setEditorOpen(true);
    };
    
    const handleDeleteArticle = async (article) => {
        const confirmed = window.confirm(`Are you sure you want to delete "${article.title}"?`);
        if (!confirmed) return;
        
        try {
            await deleteKnowledgeBaseArticle(article.originalId);
            notify('success', 'Article deleted successfully');
            loadArticles();
        } catch (error) {
            console.error('Failed to delete article:', error);
            notify('error', 'Failed to delete article');
        }
    };
    
    const handleSaveArticle = async (payload, article) => {
        try {
            if (article?.originalId) {
                // Update existing - use original numeric ID
                await updateKnowledgeBaseArticle(article.originalId, payload);
                notify('success', 'Article updated successfully');
            } else {
                // Create new
                await createKnowledgeBaseArticle(payload);
                notify('success', 'Article created successfully');
            }
            loadArticles();
        } catch (error) {
            console.error('Failed to save article:', error);
            notify('error', 'Failed to save article');
            throw error;
        }
    };
    
    const pinsPreference = useUserPreference(KB_PINS_PREF_KEY, []);
    const perPagePreference = useUserPreference(KB_PER_PAGE_PREF_KEY, isMobile ? 10 : 12);
    const [openIds, setOpenIds] = useState(()=>new Set());
    const [pinned, setPinned] = useState(()=>new Set());
    const [tagFilter, setTagFilter] = useState(()=>new Set());
    const [perPage, setPerPage] = useState(()=> (isMobile ? 10 : 12));
    const [visibleCount, setVisibleCount] = useState(perPage);
    const sentinelRef = useRef(null);
    const pinsHydratedRef = useRef(false);
    const perPageHydratedRef = useRef(false);

    useEffect(() => {
        if (pinsHydratedRef.current) return;
        if (pinsPreference.loading) return;
        pinsHydratedRef.current = true;
        const raw = Array.isArray(pinsPreference.value) ? pinsPreference.value : [];
        setPinned(new Set(raw));
    }, [pinsPreference.loading, pinsPreference.value]);

    useEffect(() => {
        if (!pinsHydratedRef.current) return;
        pinsPreference.setValue(Array.from(pinned));
    }, [pinned, pinsPreference.setValue]);

    useEffect(() => {
        if (perPageHydratedRef.current) return;
        if (perPagePreference.loading) return;
        perPageHydratedRef.current = true;
        const saved = Number(perPagePreference.value);
        if (Number.isFinite(saved) && saved > 0) {
            setPerPage(saved);
        } else {
            setPerPage(isMobile ? 10 : 12);
        }
    }, [perPagePreference.loading, perPagePreference.value, isMobile]);

    useEffect(() => {
        if (!perPageHydratedRef.current) return;
        perPagePreference.setValue(perPage);
    }, [perPage, perPagePreference.setValue]);

    const allTags = useMemo(()=>{
        const m=new Map(); articles.forEach(a=>a.tags.forEach(t=>m.set(t,(m.get(t)||0)+1)));
        return Array.from(m.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
    },[articles]);

    const filtered = useMemo(()=>{
        const q = String(query||'').trim().toLowerCase();
        const match=(s)=>String(s||'').toLowerCase().includes(q);
        return articles.filter(a=>{
            const qOk = !q || match(a.title)||match(a.summary)||match(a.body)||a.tags.some(t=>match(t));
            const tagOk = tagFilter.size===0 || a.tags.some(t=>tagFilter.has(t));
            return qOk && tagOk;
        }).sort((a,b)=>{
            const pa=pinned.has(a.id)?1:0, pb=pinned.has(b.id)?1:0;
            if(pa!==pb) return pb-pa;
            return a.title.localeCompare(b.title);
        });
    },[articles, query, tagFilter, pinned]);

    const paged = filtered.slice(0, visibleCount);

    useEffect(()=>setVisibleCount(perPage),[query, tagFilter, perPage]);

    useEffect(()=>{
        if(!sentinelRef.current) return;
        const ob=new IntersectionObserver(([e])=>{
            if(e.isIntersecting) setVisibleCount(c=>Math.min(c+perPage, filtered.length));
        },{rootMargin:'200px 0px'});
        ob.observe(sentinelRef.current);
        return ()=>ob.disconnect();
    },[filtered.length, perPage]);

    const allOpenVisible = useMemo(()=>paged.length>0 && paged.every(a=>openIds.has(a.id)),[paged, openIds]);

    const cyclePerPage = ()=>{
        const opts = [6,10,12,16,24,48];
        const i = opts.indexOf(Number(perPage));
        const next = opts[(i+1)%opts.length];
        setPerPage(next);
    };

    return (
        <>
            <section id={anchorId} className="bg-card rounded-lg border border-border p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-semibold">Knowledge Base</h2>
                        <span className="text-[11px] sm:text-xs text-muted-foreground">{filtered.length} topics</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {isTeacher && (
                            <Button
                                size="xs"
                                variant="default"
                                iconName="Plus"
                                onClick={handleCreateArticle}
                                className="order-1 sm:order-none"
                            >
                                Create Article
                            </Button>
                        )}
                        <Button
                            size="xs"
                            variant="outline"
                            onClick={()=>{
                                setOpenIds(prev=>{
                                    const next=new Set(prev);
                                    if(allOpenVisible){ paged.forEach(a=>next.delete(a.id)); }
                                    else { paged.forEach(a=>next.add(a.id)); }
                                    return next;
                                });
                            }}
                            iconName="ChevronsUpDown"
                            className="order-2 sm:order-none"
                        >
                            {allOpenVisible?'Collapse all':'Expand all'}
                        </Button>
                        <div className="order-3 sm:order-none flex items-center gap-1">
                            <span className="hidden sm:inline text-[11px] text-muted-foreground">Per page</span>
                            <div className="sm:w-[110px]">
                                <div className="sm:block hidden">
                                    <Select
                                        value={perPage}
                                        onChange={(v)=>setPerPage(Number(v))}
                                        options={[6,10,12,16,24,48].map(n=>({value:n,label:String(n)}))}
                                    />
                                </div>
                                <div className="sm:hidden">
                                    <Button size="xs" variant="outline" onClick={cyclePerPage}>
                                        {perPage} / page
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Category Filter */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition whitespace-nowrap ${
                                selectedCategory === category
                                    ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                    : 'bg-muted border-border text-muted-foreground hover:bg-muted/60'
                            }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="flex items-center gap-1 grow flex-wrap overflow-visible pr-1 min-w-0">
                        {allTags.map(([t,n])=>{
                            const active=tagFilter.has(t);
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={()=>setTagFilter(prev=>{ const next=new Set(prev); active?next.delete(t):next.add(t); return next; })}
                                    className={`text-[11px] px-2 py-0.5 rounded border transition whitespace-nowrap ${active ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground hover:bg-muted/60'}`}
                                    title={`${n} topic(s)`}
                                >
                                    {t} <span className="opacity-70">({n})</span>
                                </button>
                            );
                        })}
                    </div>
                    {tagFilter.size>0 && (
                        <button
                            className="shrink-0 text-[11px] px-2 py-0.5 rounded border bg-muted border-border text-muted-foreground order-2 basis-full sm:order-none sm:basis-auto"
                            onClick={()=>setTagFilter(new Set())}
                        >
                            Clear filters
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                        <p className="text-muted-foreground">Loading knowledge base...</p>
                    </div>
                ) : paged.length===0 ? (
                    <div className="text-center py-12">
                        <Icon name="FileQuestion" size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground mb-4">No articles found.</p>
                        {isTeacher && (
                            <Button size="sm" variant="default" iconName="Plus" onClick={handleCreateArticle}>
                                Create First Article
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {paged.map(a=>(
                            <KBItem
                                key={a.id}
                                article={a}
                                open={openIds.has(a.id)}
                                onToggle={()=>setOpenIds(prev=>{ const next=new Set(prev); next.has(a.id)?next.delete(a.id):next.add(a.id); return next; })}
                                pinned={pinned.has(a.id)}
                                onTogglePin={()=>setPinned(prev=>{ const next=new Set(prev); next.has(a.id)?next.delete(a.id):next.add(a.id); return next; })}
                                query={query}
                                isTeacher={isTeacher}
                                onEdit={handleEditArticle}
                                onDelete={handleDeleteArticle}
                            />
                        ))}
                    </div>
                )}

                {visibleCount < filtered.length && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            onClick={()=>setVisibleCount(c=>Math.min(c+perPage, filtered.length))}
                            iconName="MoreHorizontal"
                            className="w-full sm:w-auto"
                        >
                            Show more
                        </Button>
                        <span className="text-xs text-muted-foreground">{visibleCount} / {filtered.length}</span>
                    </div>
                )}
                <div ref={sentinelRef} className="h-1" />
            </section>
            
            <ArticleEditorModal
                isOpen={editorOpen}
                onClose={() => {
                    setEditorOpen(false);
                    setEditingArticle(null);
                }}
                article={editingArticle}
                onSave={handleSaveArticle}
            />
        </>
    );
};

export default KnowledgeBase;