// src/pages/study-selection/components/MobileStudiesList.jsx
import React from "react";
import Button from "components/ui/Button";
import Icon from "components/AppIcon";
import { Checkbox } from "components/ui/Checkbox";
import { degreeOf } from "../utils/studyUtils";

const MobileStudiesList = ({ studies, remember, onRememberChange, onChoose, onBack }) => {
    return (
        <div className="block md:hidden">
            <div className="px-3 py-3 border-b border-border/70 flex items-center justify-between">
                <label htmlFor="rememberStudy_mob" className="inline-flex items-center gap-2 text-sm">
                    <Checkbox
                        id="rememberStudy_mob"
                        checked={remember}
                        onChange={(e) => onRememberChange(!!e?.target?.checked)}
                        aria-checked={remember ? "true" : "false"}
                    />
                    Remember this choice
                </label>
                <Button size="sm" variant="outline" onClick={onBack} iconName="ArrowLeft">
                    Back
                </Button>
            </div>

            <ul className="divide-y divide-border/70">
                {studies.map((row) => (
                    <li key={row.uid} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                  <span
                      className={
                          row.ongoing
                              ? "inline-flex items-center gap-1.5 text-success text-xs font-medium"
                              : "inline-flex items-center gap-1.5 text-muted-foreground text-xs font-medium"
                      }
                  >
                    {row.ongoing ? <Icon name="PlayCircle" size={14} /> : <Icon name="PauseCircle" size={14} />}
                      {row.ongoing ? "Active" : "Completed"}
                  </span>
                                    {degreeOf(row) && (
                                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] border border-border">{degreeOf(row)}</span>
                                    )}
                                </div>

                                <div className="mt-1 text-sm font-semibold truncate">{row.programName}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{row.programCode}</div>

                                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-foreground/80">
                                    <div className="rounded border border-border px-2 py-1 bg-muted/40">Faculty: {row.faculty}</div>
                                    <div className="rounded border border-border px-2 py-1 bg-muted/40">OSP: {row.ospYear}</div>
                                </div>

                                <div className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                                    {row.ongoing ? <Icon name="Activity" size={14} /> : <Icon name="Archive" size={14} />}
                                    {row.ongoing ? "In progress" : "Archived"}
                                </div>
                            </div>
                            <div className="shrink-0">
                                <Button size="sm" onClick={() => onChoose(row)} iconName="CheckSquare">
                                    Select
                                </Button>
                            </div>
                        </div>
                    </li>
                ))}

                {studies.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No studies found.</li>}
            </ul>
        </div>
    );
};

export default MobileStudiesList;