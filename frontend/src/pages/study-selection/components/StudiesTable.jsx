// src/pages/study-selection/components/StudiesTable.jsx
import React from "react";
import Button from "components/ui/Button";
import Icon from "components/AppIcon";
import { Checkbox } from "components/ui/Checkbox";
import { degreeOf } from "../utils/studyUtils";

const StudiesTable = ({ studies, remember, onRememberChange, onChoose, onBack }) => {
    return (
        <div className="hidden md:block w-full overflow-x-auto">
            <table className="min-w-full">
                <thead className="bg-muted/40">
                <tr className="text-left">
                    <th className="px-4 py-3 text-sm font-semibold text-foreground/80 w-[140px]">Status</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground/80">Study Program</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground/80 w-[120px]">Faculty</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground/80 w-[110px]">OSP Year</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground/80 w-[140px]">Period</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground/80 text-right w-[120px]"></th>
                </tr>
                </thead>
                <tbody>
                {studies.map((row) => (
                    <tr key={row.uid} className="border-t border-border/70 hover:bg-muted/40">
                        <td className="px-4 py-3 text-sm">
                <span className={row.ongoing ? "inline-flex items-center gap-2 text-success" : "inline-flex items-center gap-2 text-muted-foreground"}>
                  {row.ongoing ? <Icon name="PlayCircle" size={14} /> : <Icon name="PauseCircle" size={14} />}
                    {row.ongoing ? "Active" : "Completed"}
                </span>
                        </td>
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                                {degreeOf(row) && <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] border border-border">{degreeOf(row)}</span>}
                                <div className="text-sm font-medium">{row.programName}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{row.programCode}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">{row.faculty}</td>
                        <td className="px-4 py-3 text-sm">{row.ospYear}</td>
                        <td className="px-4 py-3 text-sm">
                            {row.ongoing ? (
                                <span className="inline-flex items-center gap-2 text-primary">
                    <Icon name="Activity" size={14} /> In progress
                  </span>
                            ) : (
                                <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Icon name="Archive" size={14} /> Archived
                  </span>
                            )}
                        </td>
                        <td className="px-4 py-3 text-right">
                            <Button size="sm" onClick={() => onChoose(row)} iconName="CheckSquare">
                                Select
                            </Button>
                        </td>
                    </tr>
                ))}
                {studies.length === 0 && (
                    <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                            No studies found.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-border/70">
                <label htmlFor="rememberStudy" className="inline-flex items-center gap-2 text-sm">
                    <Checkbox
                        id="rememberStudy"
                        checked={remember}
                        onChange={(e) => onRememberChange(!!e?.target?.checked)}
                        aria-checked={remember ? "true" : "false"}
                    />
                    Remember this choice
                </label>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={onBack} iconName="ArrowLeft">
                        Back
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default StudiesTable;