// src/pages/grade-management/components/GradingScaleManager.jsx
import React, { useMemo, useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const GradingScaleManager = ({ currentScale = 'standard', onScaleUpdate, userRole = 'teacher' }) => {
  const isTeacher = userRole === 'teacher';
  const [activeScale, setActiveScale] = useState(currentScale);
  const [isEditing, setIsEditing] = useState(false);

  const [customScale, setCustomScale] = useState([
    { grade: 'A+', min: 97, max: 100, points: 4.0 },
    { grade: 'A', min: 93, max: 96, points: 4.0 },
    { grade: 'A-', min: 90, max: 92, points: 3.7 },
    { grade: 'B+', min: 87, max: 89, points: 3.3 },
    { grade: 'B', min: 83, max: 86, points: 3.0 },
    { grade: 'B-', min: 80, max: 82, points: 2.7 },
    { grade: 'C+', min: 77, max: 79, points: 2.3 },
    { grade: 'C', min: 73, max: 76, points: 2.0 },
    { grade: 'C-', min: 70, max: 72, points: 1.7 },
    { grade: 'D+', min: 67, max: 69, points: 1.3 },
    { grade: 'D', min: 63, max: 66, points: 1.0 },
    { grade: 'D-', min: 60, max: 62, points: 0.7 },
    { grade: 'F', min: 0, max: 59, points: 0.0 },
  ]);

  const predefinedScales = useMemo(
      () => [
        {
          id: 'standard',
          name: 'Standard Scale',
          description: 'Traditional A–F grading scale',
          scale: [
            { grade: 'A', min: 90, max: 100, points: 4.0 },
            { grade: 'B', min: 80, max: 89, points: 3.0 },
            { grade: 'C', min: 70, max: 79, points: 2.0 },
            { grade: 'D', min: 60, max: 69, points: 1.0 },
            { grade: 'F', min: 0, max: 59, points: 0.0 },
          ],
        },
        {
          id: 'plus_minus',
          name: 'Plus/Minus Scale',
          description: 'Extended scale with + and − modifiers',
          scale: customScale,
        },
        {
          id: 'percentage',
          name: 'Percentage Only',
          description: 'Raw percentage ranges without letters',
          scale: [
            { grade: '100%', min: 100, max: 100, points: 4.0 },
            { grade: '90–99%', min: 90, max: 99, points: 3.5 },
            { grade: '80–89%', min: 80, max: 89, points: 3.0 },
            { grade: '70–79%', min: 70, max: 79, points: 2.5 },
            { grade: '60–69%', min: 60, max: 69, points: 2.0 },
            { grade: '0–59%', min: 0, max: 59, points: 0.0 },
          ],
        },
        {
          id: 'pass_fail',
          name: 'Pass/Fail',
          description: 'Simple pass or fail grading',
          scale: [
            { grade: 'Pass', min: 70, max: 100, points: 4.0 },
            { grade: 'Fail', min: 0, max: 69, points: 0.0 },
          ],
        },
      ],
      [customScale]
  );

  const scaleOptions = useMemo(
      () => predefinedScales.map((s) => ({ value: s.id, label: s.name, description: s.description })),
      [predefinedScales]
  );

  const currentScaleData = predefinedScales.find((s) => s.id === activeScale) || predefinedScales[0];

  const handleScaleChange = (id) => {
    setActiveScale(id);
    if (onScaleUpdate) {
      const payload = predefinedScales.find((s) => s.id === id);
      onScaleUpdate(payload);
    }
    setIsEditing(false);
  };

  const setCustomField = (idx, field, raw) => {
    const v = field === 'grade' ? raw : raw === '' ? '' : Number.isNaN(parseFloat(raw)) ? 0 : parseFloat(raw);
    setCustomScale((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: v };
      return next;
    });
  };

  const addRow = () => {
    setCustomScale((prev) => [...prev, { grade: '', min: 0, max: 0, points: 0.0 }]);
  };

  const removeRow = (idx) => setCustomScale((prev) => prev.filter((_, i) => i !== idx));

  const normalizeAndValidate = (rows) => {
    const clamped = rows.map((r) => ({
      ...r,
      min: Math.max(0, Math.min(100, Number(r.min))),
      max: Math.max(0, Math.min(100, Number(r.max))),
      points: Math.max(0, Math.min(4, Number(r.points))),
    }));
    const cleaned = clamped.map((r) => (r.min > r.max ? { ...r, min: r.max } : r));
    return [...cleaned].sort((a, b) => b.min - a.min);
  };

  const saveCustom = () => {
    const nextScale = normalizeAndValidate(customScale);
    setCustomScale(nextScale);
    if (onScaleUpdate) onScaleUpdate({ id: 'plus_minus', scale: nextScale });
    setActiveScale('plus_minus');
    setIsEditing(false);
  };

  const letterColor = (g) => {
    if (String(g).includes('Fail') || String(g).includes('F')) return 'text-error';
    if (String(g).includes('A') || String(g).includes('Pass')) return 'text-success';
    if (String(g).includes('B')) return 'text-accent';
    if (String(g).includes('C')) return 'text-warning';
    if (String(g).includes('D')) return 'text-orange-600';
    return 'text-foreground';
  };

  const letterFor = (pct) => {
    const hit = currentScaleData?.scale?.find((r) => pct >= r.min && pct <= r.max) || null;
    return hit ? hit.grade : 'N/A';
  };

  return (
      <section className="w-full">
        <div className="w-full glass-card rounded-lg border border-border overflow-hidden shadow-card" style={{ scrollbarGutter: 'stable both-edges' }}>
          <div className="px-4 sm:px-6 py-4 border-b border-border bg-surface/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">Grading Scale</h3>
                <p className="text-sm text-muted-foreground mt-1">Configure how grades are calculated and displayed</p>
              </div>
              {isTeacher && activeScale === 'plus_minus' && (
                  <div className="flex gap-2">
                    <Button variant={isEditing ? 'outline' : 'default'} iconName={isEditing ? 'X' : 'Settings'} onClick={() => setIsEditing((v) => !v)} className="btn-neo">
                      {isEditing ? 'Cancel' : 'Customize'}
                    </Button>
                  </div>
              )}
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,480px)_auto] gap-3 md:items-end">
              <Select
                  label="Grading Scale"
                  description="Choose the grading scale for this class"
                  options={scaleOptions}
                  value={activeScale}
                  onChange={handleScaleChange}
                  disabled={!isTeacher}
                  className="w-full"
              />
              {isTeacher && activeScale === 'plus_minus' && (
                  <div className="hidden md:flex justify-end">
                    <Button variant={isEditing ? 'outline' : 'default'} iconName={isEditing ? 'X' : 'Settings'} onClick={() => setIsEditing((v) => !v)}>
                      {isEditing ? 'Cancel' : 'Customize'}
                    </Button>
                  </div>
              )}
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h4 className="text-base sm:text-lg font-semibold text-foreground">{currentScaleData?.name} Preview</h4>
              <span className="text-xs sm:text-sm text-muted-foreground">{currentScaleData?.description}</span>
            </div>

            <div className="md:hidden space-y-2">
              {(isEditing ? customScale : currentScaleData?.scale)?.map((level, idx) => (
                  <div key={`m-${idx}`} className="rounded-md border border-border bg-card p-3">
                    {!isEditing ? (
                        <div className="grid grid-cols-2 gap-2 items-center">
                          <div>
                            <div className={`font-medium ${letterColor(level.grade)}`}>{level.grade}</div>
                            <div className="text-xs text-muted-foreground">
                              {level.min}% – {level.max}%
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-foreground">{Number(level.points).toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">GPA</div>
                          </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                          <Input label="Letter" value={level.grade} onChange={(e) => setCustomField(idx, 'grade', e.target.value)} />
                          <div className="grid grid-cols-2 gap-3">
                            <Input label="Min %" type="number" min="0" max="100" value={level.min} onChange={(e) => setCustomField(idx, 'min', e.target.value)} />
                            <Input label="Max %" type="number" min="0" max="100" value={level.max} onChange={(e) => setCustomField(idx, 'max', e.target.value)} />
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                            <Input label="GPA" type="number" step="0.1" min="0" max="4" value={level.points} onChange={(e) => setCustomField(idx, 'points', e.target.value)} />
                            <Button
                                variant="ghost"
                                size="icon"
                                iconName="Trash2"
                                onClick={() => removeRow(idx)}
                                className="text-error hover:text-error hover:bg-error/10"
                                disabled={customScale.length <= 2}
                                aria-label="Remove"
                            />
                          </div>
                        </div>
                    )}
                  </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-[720px] w-full border border-border rounded-lg">
                <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground border-b border-border">Letter Grade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground border-b border-border">Percentage Range</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground border-b border-border">GPA Points</th>
                  {isEditing && <th className="px-4 py-3 text-left text-sm font-medium text-foreground border-b border-border">Actions</th>}
                </tr>
                </thead>
                <tbody className="divide-y divide-border">
                {(isEditing ? customScale : currentScaleData?.scale)?.map((level, idx) => (
                    <tr key={`d-${idx}`} className="hover:bg-muted/30 transition-colors duration-200">
                      <td className="px-4 py-3">
                        {!isEditing ? (
                            <span className={`font-medium ${letterColor(level.grade)}`}>{level.grade}</span>
                        ) : (
                            <Input type="text" value={level.grade} onChange={(e) => setCustomField(idx, 'grade', e.target.value)} className="w-24" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!isEditing ? (
                            <span className="text-foreground">
                          {level.min}% – {level.max}%
                        </span>
                        ) : (
                            <div className="flex items-center gap-2">
                              <Input type="number" value={level.min} onChange={(e) => setCustomField(idx, 'min', e.target.value)} className="w-20" min="0" max="100" />
                              <span className="text-muted-foreground">–</span>
                              <Input type="number" value={level.max} onChange={(e) => setCustomField(idx, 'max', e.target.value)} className="w-20" min="0" max="100" />
                            </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!isEditing ? (
                            <span className="text-foreground">{Number(level.points).toFixed(1)}</span>
                        ) : (
                            <Input type="number" value={level.points} onChange={(e) => setCustomField(idx, 'points', e.target.value)} className="w-24" min="0" max="4" step="0.1" />
                        )}
                      </td>
                      {isEditing && (
                          <td className="px-2 py-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                iconName="Trash2"
                                onClick={() => removeRow(idx)}
                                className="text-error hover:text-error hover:bg-error/10"
                                disabled={customScale.length <= 2}
                                aria-label="Remove"
                            />
                          </td>
                      )}
                    </tr>
                ))}
                </tbody>
              </table>
            </div>

            {isEditing && (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <Button variant="outline" iconName="Plus" onClick={addRow}>
                    Add Grade Level
                  </Button>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button variant="default" onClick={saveCustom}>
                      Save Changes
                    </Button>
                  </div>
                </div>
            )}
          </div>
        </div>
      </section>
  );
};

export default GradingScaleManager;