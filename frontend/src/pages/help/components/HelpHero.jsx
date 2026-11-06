import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const ExtraHoverCSS = `
.qk-tile{position:relative;overflow:hidden;transform:translateZ(0);transition:transform .18s ease, box-shadow .18s ease, border-color .18s}
.qk-tile:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.25)}
.qk-tile::after{content:"";position:absolute;inset:-150% -30%;background:linear-gradient(120deg,transparent 45%,rgba(255,255,255,.18) 50%,transparent 55%);transform:translateX(-60%);opacity:0;pointer-events:none}
.qk-tile:hover::after{animation:qk-shine .7s ease forwards}
@keyframes qk-shine{to{transform:translateX(60%);opacity:1}}
.qk-icon{transition:transform .22s ease, filter .22s ease}
.qk-tile:hover .qk-icon{transform:translateY(-3px) rotate(-8deg) scale(1.06);filter:drop-shadow(0 6px 10px rgba(0,0,0,.25))}
.qk-label{transition:letter-spacing .18s ease, color .18s ease, transform .18s ease}
.qk-tile:hover .qk-label{letter-spacing:.02em;transform:translateY(-1px)}
`;

const QuickTile = ({ icon, label, onClick, toTitle }) => (
    <button
        type="button"
        onClick={onClick}
        title={toTitle || label}
        className="qk-tile group relative w-full rounded-lg border border-border bg-card px-3 py-3 transition hover:bg-muted/50 hover:border-primary/40 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
        <div className="flex md:flex-row lg:flex-col items-center md:items-center lg:items-center gap-2 min-w-0">
            <div className="qk-icon grid place-items-center w-10 h-10 rounded-md border border-border bg-muted shrink-0">
                <Icon name={icon} size={16} className="opacity-80" aria-hidden="true" />
            </div>
            <div className="text-xs sm:text-sm font-medium text-foreground text-center md:text-left lg:text-center leading-tight w-full min-w-0">
                <span className="qk-label block truncate md:truncate lg:line-clamp-2">{label}</span>
            </div>
        </div>
    </button>
);

const HelpHero = ({
                      role = 'student',
                      search, onSearch,
                      onOpenPalette, onJumpTo,
                      onDownloadBundle, onClearCache, clearing,
                      bundleMsg
                  }) => {
    return (
        <section
            className="bg-card rounded-lg border border-border p-4 sm:p-5 md:p-6 mb-6"
            aria-labelledby="help-hero-title"
        >
            <style>{ExtraHoverCSS}</style>

            <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3 space-y-4 min-w-0">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="h-9 w-9 rounded-md border border-border bg-muted text-foreground grid place-items-center shrink-0">
                            <Icon name="LifeBuoy" size={18} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h1 id="help-hero-title" className="text-xl sm:text-2xl font-semibold leading-tight truncate">
                                Help &amp; Support
                            </h1>
                            <p className="text-xs sm:text-sm text-muted-foreground break-words">
                                Docs • Diagnostics • Bug reporting • Shortcuts
                            </p>
                        </div>
                    </div>

                    <div className="relative">
                        <label className="sr-only" htmlFor="help-search">Search help</label>
                        <Icon
                            name="Search"
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <input
                            id="help-search"
                            type="search"
                            value={search}
                            onChange={(e)=>onSearch(e.target.value)}
                            placeholder='Search topics, e.g. “attendance”, “office hours”…'
                            className="w-full rounded-md border border-border bg-background pl-9 pr-3 xl:pr-24 py-2.5 text-sm xl:text-base shadow-sm"
                        />
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden xl:flex items-center gap-1 text-[11px] text-muted-foreground">
                            <kbd className="px-1 rounded bg-muted border border-border">⌘/Ctrl</kbd>
                            <span>+</span>
                            <kbd className="px-1 rounded bg-muted border border-border">K</kbd>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                        <QuickTile icon="HelpCircle" label="Knowledge Base" onClick={()=>onJumpTo('kb')} />
                        <QuickTile icon="Activity"   label="Diagnostics"    onClick={()=>onJumpTo('diagnostics')} />
                        <QuickTile icon="Bug"        label="Report a Bug"   onClick={()=>onJumpTo('bug')} />
                        <QuickTile icon="Keyboard"   label="Shortcuts"      onClick={()=>onJumpTo('shortcuts')} />
                    </div>
                </div>

                <div className="lg:col-span-2 lg:max-w-sm lg:justify-self-end lg:self-start space-y-3 w-full">
                    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Quick actions</div>
                        <div className="grid grid-cols-1 gap-2">
                            <Button className="w-full" variant="default"     iconName="Command"  onClick={onOpenPalette}>Command Palette</Button>
                            <Button className="w-full" variant="outline"     iconName="Download" onClick={onDownloadBundle}>Support Bundle</Button>
                            <Button className="w-full" variant="outline"     iconName="Bug"      onClick={()=>onJumpTo('bug')}>Report a Bug</Button>
                            <Button className="w-full" variant="destructive" iconName="Eraser"   onClick={onClearCache} disabled={clearing}>
                                {clearing ? 'Clearing…' : 'Clear Local Cache'}
                            </Button>
                        </div>
                    </div>
                    {!!bundleMsg && <div className="text-xs text-accent break-words">{bundleMsg}</div>}
                </div>
            </div>
        </section>
    );
};

export default HelpHero;