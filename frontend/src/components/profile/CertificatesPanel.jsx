import React, { useRef, useState, useMemo } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';

/* ---------- helpers ---------- */
const fmtDate = (d) => { if(!d) return '—'; const x=new Date(d); return isNaN(+x)?'—':x.toLocaleDateString(); };
const daysLeft = (dateStr)=>{ if(!dateStr) return null; const d=new Date(dateStr); if(isNaN(+d)) return null; return Math.ceil((d.getTime()-Date.now())/(24*60*60*1000)); };
const certState = (cert)=>{ const left=daysLeft(cert?.expiresOn); if(left!=null && left<0) return {label:'Expired',cls:'bg-destructive text-destructive-foreground',ratio:1}; if(left!=null && left<=30) return {label:'Expiring soon',cls:'bg-warning text-warning-foreground',ratio:Math.max(0,(30-left)/30)}; return {label:'Valid',cls:'bg-success text-success-foreground',ratio:0}; };
const FileTypeBadge = ({ type })=>{ const t=(type||'').toLowerCase(); const label = t.includes('pdf') ? 'PDF' : t.match(/png|jpg|jpeg|webp|gif/) ? 'Image' : 'File'; return <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">{label}</span>; };

/* ---------- Preview modal ---------- */
const CertPreviewModal = ({ open, onClose, cert }) => {
    if (!open || !cert) return null;
    const isImg = /\.(png|jpg|jpeg|webp|gif)$/i.test(cert.fileName||'') || /image\//.test(cert.mimeType||'');
    const isPdf = /\.(pdf)$/i.test(cert.fileName||'') || /pdf/.test(cert.mimeType||'');

    return (
        <div className="fixed inset-0 z-[120]">
            <button type="button" className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-3xl bg-card border border-border rounded-lg shadow-modal overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Icon name="Award" size={18} />
                            <div className="text-sm font-semibold">{cert.title||cert.fileName||'Certificate'}</div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                            <Icon name="X" size={18} />
                        </Button>
                    </div>
                    <div className="p-4 max-h-[75vh] overflow-auto">
                        {isImg && <img src={cert.fileUrl} alt={cert.title||cert.fileName} className="w-full h-auto rounded-md" />}
                        {isPdf && <iframe title="Certificate" src={cert.fileUrl} className="w-full h-[70vh] rounded-md" />}
                        {!isImg && !isPdf && (
                            <div className="p-6 text-sm text-muted-foreground">Preview unavailable. Use Download to open the file.</div>
                        )}
                    </div>
                    <div className="p-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                            {cert.issuer ? `Issuer: ${cert.issuer}` : ''}{cert.code ? ` • Code: ${cert.code}` : ''}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {cert.fileUrl && (
                                <>
                                    <a href={cert.fileUrl} download={cert.fileName||'certificate'} className="inline-flex">
                                        <Button type="button" variant="default" iconName="Download">Download</Button>
                                    </a>
                                    <Button type="button" variant="outline" iconName="Copy" onClick={()=>navigator.clipboard?.writeText(cert.fileUrl)}>Copy link</Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ---------- Card ---------- */
const CertificateCard = ({ cert, editable, onChange, onRemove, onPrimary }) => {
    const [open, setOpen] = useState(false);
    const fileInputRef = useRef(null);
    const isImg = /\.(png|jpg|jpeg|webp|gif)$/i.test(cert?.fileName||'') || /image\//.test(cert?.mimeType||'');
    const thumb = isImg ? cert?.fileUrl : null;
    const state = certState(cert);
    const left = daysLeft(cert?.expiresOn);

    const full = 'min-w-0 w-full [&_input]:w-full [&_select]:w-full';

    return (
        <div className="rounded-lg border border-border p-3 sm:p-4 bg-muted/20 flex flex-col sm:flex-row gap-3 min-w-0">
            <div className="w-full h-28 sm:w-16 sm:h-16 rounded-md bg-muted border border-border overflow-hidden grid place-items-center shrink-0">
                {thumb ? <img src={thumb} alt="thumb" className="w-full h-full object-cover" /> : <Icon name="FileText" size={20} className="text-muted-foreground" />}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{cert.title||cert.fileName||'Certificate'}</div>
                        <FileTypeBadge type={cert.mimeType||cert.fileName||''} />
                        <span className={`text-[11px] px-2 py-0.5 rounded ${state.cls} shrink-0`}>{state.label}</span>
                        {Number.isFinite(left) && left>=0 && <span className="text-[11px] text-muted-foreground shrink-0">({left}d left)</span>}
                        {cert.primary && <span className="text-[11px] px-2 py-0.5 rounded bg-primary text-primary-foreground shrink-0">Primary</span>}
                    </div>
                    {editable && (
                        <Button type="button" size="xs" variant="ghost" iconName="Star" onClick={onPrimary} title="Mark as primary" />
                    )}
                </div>

                {editable ? (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        <div className={full}><Input placeholder="Title" value={cert.title||''} onChange={(e)=>onChange({...cert,title:e.target.value})} /></div>
                        <div className={full}><Input placeholder="Issuer" value={cert.issuer||''} onChange={(e)=>onChange({...cert,issuer:e.target.value})} /></div>
                        <div className={full}><Input placeholder="Verification code" value={cert.code||''} onChange={(e)=>onChange({...cert,code:e.target.value})} /></div>
                        <div className={full}><Input type="date" placeholder="Issued" value={(cert.issuedOn||'').slice(0,10)} onChange={(e)=>onChange({...cert,issuedOn:e.target.value})} /></div>
                        <div className={full}><Input type="date" placeholder="Expires" value={(cert.expiresOn||'').slice(0,10)} onChange={(e)=>onChange({...cert,expiresOn:e.target.value})} /></div>
                        <div className={full}><Input placeholder="Tags (comma)" value={(cert.tags||[]).join(', ')} onChange={(e)=>onChange({...cert,tags:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} /></div>

                        <div className="col-span-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className={full}>
                                <Input
                                    placeholder="File URL"
                                    value={cert.fileUrl||''}
                                    onChange={(e)=>onChange({...cert,fileUrl:e.target.value})}
                                />
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e)=>{ const f=e.target.files?.[0]; if(!f) return; const url=URL.createObjectURL(f); onChange({...cert,fileUrl:url,fileName:f.name,mimeType:f.type}); }}
                            />
                            <Button type="button" variant="outline" onClick={()=>fileInputRef.current?.click()}>Upload</Button>
                        </div>

                        <div className={full + ' col-span-full'}>
                            <Input placeholder="Notes" value={cert.notes||''} onChange={(e)=>onChange({...cert,notes:e.target.value})} />
                        </div>
                    </div>
                ) : (
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5 break-words">
                        <div>{cert.issuer ? `Issuer: ${cert.issuer}` : ''}{cert.code ? ` • Code: ${cert.code}` : ''}</div>
                        <div>{cert.issuedOn ? `Issued: ${fmtDate(cert.issuedOn)}` : ''}{cert.expiresOn ? ` • Expires: ${fmtDate(cert.expiresOn)}` : ''}</div>
                        {Array.isArray(cert.tags)&&cert.tags.length>0 && <div>Tags: {cert.tags.join(', ')}</div>}
                        {cert.notes && <div className="line-clamp-2">Notes: {cert.notes}</div>}
                    </div>
                )}

                {Number.isFinite(state.ratio) && state.ratio>0 && (
                    <div className="mt-2 h-1.5 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-warning" style={{ width: `${Math.min(100, Math.round(state.ratio*100))}%` }} />
                    </div>
                )}

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {cert.fileUrl && <Button type="button" size="sm" variant="outline" iconName="Eye" onClick={()=>setOpen(true)}>View</Button>}
                    {cert.fileUrl && (
                        <>
                            <a href={cert.fileUrl} download={cert.fileName||'certificate'} className="inline-flex">
                                <Button type="button" size="sm" variant="ghost" iconName="Download">Download</Button>
                            </a>
                            <Button type="button" size="sm" variant="ghost" onClick={()=>navigator.clipboard?.writeText(cert.fileUrl||'')} iconName="Copy">Copy link</Button>
                        </>
                    )}
                    {editable && <Button type="button" size="sm" variant="ghost" iconName="Trash2" onClick={onRemove}>Remove</Button>}
                </div>
            </div>

            <CertPreviewModal open={open} onClose={()=>setOpen(false)} cert={cert} />
        </div>
    );
};

/* ---------- Panel ---------- */
const CertificatesPanel = ({ certs = [], isEditing = false, editable, onChange }) => {
    const canEdit = (editable ?? isEditing) === true;
    const [q, setQ] = useState('');
    const [sort, setSort] = useState('expires');

    const setCerts    = (next)=>onChange?.(next);
    const setCertAt   = (i, next)=>setCerts(certs.map((c,idx)=>idx===i?next:c));
    const removeAt    = (i)=>setCerts(certs.filter((_,idx)=>idx!==i));
    const addEmpty    = ()=>setCerts([...(certs||[]), { title:'', issuer:'', issuedOn:'', expiresOn:'', fileUrl:'', fileName:'', mimeType:'', tags:[], notes:'', code:'', primary:false }]);
    const makePrimary = (i)=>setCerts(certs.map((c,idx)=>({ ...c, primary: idx===i })));

    const bySearch = (c, s)=>{
        const hay = [c.title,c.issuer,c.fileName,c.notes,(c.tags||[]).join(' '),c.code].join(' ').toLowerCase();
        return hay.includes(s);
    };
    const toTs = (d)=>{ const x=new Date(d); return isNaN(+x)?0:+x; };

    const sorted = useMemo(()=>{
        const s = q.trim().toLowerCase();
        return [...(certs||[])]
            .filter(c => !s || bySearch(c, s))
            .sort((a,b)=>{
                if(sort==='title')  return (a.title||'').localeCompare(b.title||'');
                if(sort==='issued') return toTs(b.issuedOn) - toTs(a.issuedOn);
                return toTs(a.expiresOn||'9999-12-31') - toTs(b.expiresOn||'9999-12-31');
            });
    }, [certs, q, sort]);

    return (
        <section className="bg-card rounded-lg border border-border p-4 sm:p-6">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold">Certifications</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <Input
                        placeholder="Search…"
                        value={q}
                        onChange={(e)=>setQ(e.target.value)}
                        className="w-full sm:w-64 md:w-72"
                    />
                    <Select
                        value={sort}
                        onChange={(v)=>setSort(v)}
                        options={[
                            {value:'expires', label:'By Expiry'},
                            {value:'issued',  label:'By Issued'},
                            {value:'title',   label:'By Title'},
                        ]}
                    />
                    {canEdit && (
                        <Button type="button" iconName="Plus" onClick={addEmpty}>
                            Add
                        </Button>
                    )}
                </div>
            </div>

            {/* Mobile-first: single column; scales up cleanly */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-w-0">
                {sorted.length ? (
                    sorted.map((c,i)=>(
                        <CertificateCard
                            key={i}
                            cert={c}
                            editable={canEdit}
                            onChange={(next)=>setCertAt(i,next)}
                            onRemove={()=>removeAt(i)}
                            onPrimary={()=>makePrimary(i)}
                        />
                    ))
                ) : (
                    <div className="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-muted/10 sm:col-span-2 xl:col-span-3">
                        No certificates found.
                    </div>
                )}
            </div>
        </section>
    );
};

export default CertificatesPanel;