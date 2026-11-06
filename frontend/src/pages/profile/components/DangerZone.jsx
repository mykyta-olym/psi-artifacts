import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const DangerZone = ({ removeAvatar, handleReset }) => {
    return (
        <section className="bg-card rounded-lg border border-border p-4 sm:p-6">
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <Icon name="AlertTriangle" size={18} className="text-destructive" />
                    <h3 className="text-lg font-semibold text-foreground">Danger Zone</h3>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded border bg-destructive/10 text-destructive border-destructive/30">
          Irreversible
        </span>
            </div>

            <p className="text-sm text-muted-foreground">
                These actions cannot be undone. Proceed with caution.
            </p>

            <div className="mt-4 space-y-3">
                {/* Row 1 */}
                <div className="rounded-md border border-border bg-muted/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">Remove avatar</div>
                        <div className="text-xs text-muted-foreground">Deletes your current profile image.</div>
                    </div>
                    <Button
                        className="w-full sm:w-auto"
                        variant="destructive"
                        iconName="Trash2"
                        onClick={removeAvatar}
                    >
                        Remove
                    </Button>
                </div>

                {/* Row 2 */}
                <div className="rounded-md border border-border bg-muted/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">Reset profile</div>
                        <div className="text-xs text-muted-foreground">
                            Restore default values for all profile fields.
                        </div>
                    </div>
                    <Button
                        className="w-full sm:w-auto"
                        variant="destructive"
                        iconName="Eraser"
                        onClick={handleReset}
                    >
                        Reset
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default DangerZone;