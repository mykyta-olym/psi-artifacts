import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

/* ----------------------------------------
 * Responsive helpers
 * -------------------------------------- */
const KV = ({ label, children }) => (
    <div className="grid grid-cols-1 sm:grid-cols-[9.5rem_1fr] gap-1.5 sm:gap-3 items-start">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="min-w-0 break-words">
            {/* allow long tokens to wrap/scroll gracefully */}
            <div className="max-w-full overflow-x-auto sm:overflow-visible">
                {children}
            </div>
        </div>
    </div>
);

const Chip = ({ label }) => (
    <span className="text-[11px] px-2 py-0.5 rounded bg-muted border border-border">
    {label}
  </span>
);

const DiagStat = ({ icon, label, value, tone = 'neutral' }) => {
    const toneCls =
        tone === 'ok'
            ? 'bg-success/10 border-success/20 text-success'
            : tone === 'warn'
                ? 'bg-warning/10 border-warning/20 text-warning'
                : tone === 'bad'
                    ? 'bg-destructive/10 border-destructive/20 text-destructive'
                    : 'bg-muted border-border text-muted-foreground';
    return (
        <div
            className={`flex items-center gap-2 px-2 py-2 rounded border ${toneCls}`}
            title={label}
        >
            <Icon name={icon} size={16} />
            <div className="text-xs truncate">{label}</div>
            <div className="ml-auto text-xs font-medium truncate max-w-[50%] text-right">
                {value}
            </div>
        </div>
    );
};

/* ----------------------------------------
 * Formatters
 * -------------------------------------- */
const formatStorage = (bytes) =>
    !bytes && bytes !== 0
        ? 'n/a'
        : (() => {
            const k = 1024,
                u = ['B', 'KB', 'MB', 'GB', 'TB'];
            let i = 0,
                v = bytes;
            while (v >= k && i < u.length - 1) {
                v /= k;
                i++;
            }
            return `${v.toFixed(1)} ${u[i]}`;
        })();

const permChipCls = (v) =>
    v === 'granted'
        ? 'bg-success/10 border-success/20 text-success'
        : v === 'prompt'
            ? 'bg-warning/10 border-warning/20 text-warning'
            : v === 'denied'
                ? 'bg-destructive/10 border-destructive/20 text-destructive'
                : 'bg-muted border-border text-muted-foreground';

/* ----------------------------------------
 * Panel
 * -------------------------------------- */
const DiagnosticsPanel = ({
                              anchorId,
                              diag,
                              diagRunning,
                              diagCollapsed,
                              setDiagCollapsed,
                              runDiagnostics,
                              copyDiagnosticsJson,
                              downloadSupportBundle,
                              bundleMsg,
                          }) => (
    <section
        id={anchorId}
        className="bg-card rounded-lg border border-border p-4 md:p-6"
    >
        {/* Header: stacks on mobile */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-primary/15 grid place-items-center shrink-0">
                    <Icon name="Activity" size={16} className="text-primary" />
                </div>
                <h2 className="text-lg md:text-xl font-semibold leading-tight">
                    Diagnostics
                </h2>
            </div>

            {/* Actions: grid on mobile for better fit */}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2">
                {diag && (
                    <Button
                        className="w-full sm:w-auto text-xs sm:text-sm"
                        variant="outline"
                        size="sm"
                        iconName={diagCollapsed ? 'ChevronDown' : 'ChevronUp'}
                        onClick={() => setDiagCollapsed((v) => !v)}
                    >
                        <span className="hidden sm:inline">{diagCollapsed ? 'Expand' : 'Collapse'}</span>
                        <span className="sm:hidden">{diagCollapsed ? 'Show' : 'Hide'}</span>
                    </Button>
                )}
                <Button
                    className="w-full sm:w-auto text-xs sm:text-sm"
                    variant="outline"
                    size="sm"
                    iconName={diagRunning ? 'Loader2' : 'Play'}
                    onClick={runDiagnostics}
                    disabled={diagRunning}
                >
                    {diagRunning ? <span className="hidden sm:inline">Running…</span> : 'Run'}
                    {diagRunning && <span className="sm:hidden">…</span>}
                </Button>
                <Button
                    className="w-full sm:w-auto text-xs sm:text-sm"
                    variant="outline"
                    size="sm"
                    iconName="Copy"
                    onClick={copyDiagnosticsJson}
                    disabled={!diag}
                >
                    <span className="hidden sm:inline">Copy JSON</span>
                    <span className="sm:hidden">Copy</span>
                </Button>
            </div>
        </div>

        {/* Body */}
        {!diag ? (
            <div className="text-sm text-muted-foreground">
                Run diagnostics to collect environment info and generate a support
                bundle.
            </div>
        ) : diagCollapsed ? (
            <div className="flex flex-wrap gap-2">
                <Chip label={`Online: ${String(diag.online)}`} />
                <Chip label={`Latency: ${diag.latencyMs} ms`} />
                <Chip label={`FPS: ${diag.fps ?? 'n/a'}`} />
                <Chip label={`Cores: ${diag.hardwareConcurrency ?? 'n/a'}`} />
            </div>
        ) : (
            <div className="space-y-3 text-sm">
                {/* Responsive stats grid: 1 / 2 / 3 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    <DiagStat
                        icon="Wifi"
                        label="Online"
                        value={String(diag.online)}
                        tone={diag.online ? 'ok' : 'bad'}
                    />
                    <DiagStat
                        icon="Timer"
                        label="Timer Latency"
                        value={`${diag.latencyMs} ms`}
                        tone={diag.latencyMs < 50 ? 'ok' : diag.latencyMs < 150 ? 'warn' : 'bad'}
                    />
                    <DiagStat
                        icon="Gauge"
                        label="FPS (approx)"
                        value={diag.fps ? `${diag.fps}` : 'n/a'}
                        tone={diag.fps >= 50 ? 'ok' : diag.fps >= 30 ? 'warn' : 'bad'}
                    />
                    <DiagStat
                        icon="Cpu"
                        label="CPU Cores"
                        value={diag.hardwareConcurrency ?? 'n/a'}
                        tone="neutral"
                    />
                    <DiagStat
                        icon="HardDrive"
                        label="Storage Used"
                        value={formatStorage(diag.storage?.usage)}
                    />
                    <DiagStat
                        icon="Database"
                        label="Storage Quota"
                        value={formatStorage(diag.storage?.quota)}
                    />
                </div>

                {/* Key/Value blocks become single column on small screens */}
                <KV label="Timezone">{diag.timezone}</KV>
                <KV label="Language">{diag.language}</KV>
                <KV label="Platform">{diag.platform}</KV>
                <KV label="User Agent">
                    <code className="break-all">{diag.userAgent}</code>
                </KV>
                <KV label="Memory (GB)">{diag.deviceMemory ?? 'n/a'}</KV>
                <KV label="Viewport">
                    {diag.viewport.w}×{diag.viewport.h} @{diag.viewport.dpr}x
                </KV>
                <KV label="Color Scheme">{diag.colorScheme}</KV>

                {/* Permissions: wrap into rows; scroll horizontally on overflow X */}
                <div>
                    <div className="text-xs font-medium mb-1">Permissions</div>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(diag.permissions || {}).map(([k, v]) => (
                            <span
                                key={k}
                                className={`text-[11px] px-2 py-0.5 rounded border ${permChipCls(
                                    v
                                )}`}
                            >
                {k}: {v}
              </span>
                        ))}
                    </div>
                </div>

                {/* Graphics */}
                <div>
                    <div className="text-xs font-medium mb-1">Graphics</div>
                    <div className="flex flex-wrap gap-2">
                        <Chip label={`Vendor: ${diag.webgl?.vendor || 'n/a'}`} />
                        <Chip label={`Renderer: ${diag.webgl?.renderer || 'n/a'}`} />
                        <Chip label={`Version: ${diag.webgl?.version || 'n/a'}`} />
                    </div>
                </div>

                {/* Battery */}
                {!!diag.battery && (
                    <div>
                        <div className="text-xs font-medium mb-1">Battery</div>
                        <div className="flex flex-wrap gap-2">
                            <Chip
                                label={`Level: ${Math.round((diag.battery.level ?? 0) * 100)}%`}
                            />
                            <Chip label={`Charging: ${String(diag.battery.charging)}`} />
                        </div>
                    </div>
                )}

                {/* Preference keys: chips wrap; allow horizontal scroll on tiny screens */}
                <div>
                    <div className="text-xs font-medium mb-1">Preference Keys</div>
                    <div className="flex flex-wrap gap-1 max-w-full overflow-x-auto">
                        {diag.preferenceKeys?.map((k) => (
                            <span
                                key={k}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border"
                                title={k}
                            >
                {k}
              </span>
                        ))}
                        {!diag.preferenceKeys?.length && (
                            <span className="text-[10px] text-muted-foreground">No entries</span>
                        )}
                    </div>
                </div>

                {/* Footer actions: responsive layout */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                    <Button
                        className="w-full sm:w-auto"
                        variant="outline"
                        iconName="Download"
                        onClick={downloadSupportBundle}
                    >
                        Download Support Bundle
                    </Button>
                    {!!bundleMsg && (
                        <span className="text-xs text-accent">{bundleMsg}</span>
                    )}
                </div>
            </div>
        )}
    </section>
);

export default DiagnosticsPanel;