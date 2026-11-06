import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import { useToasts } from '../../../components/ui/Toasts';
import { maisId } from '../../../utils/ids';
import { useAuth } from '../../../contexts/AuthContext';

const AssignmentManager = ({
                             assignments = [],
                             allAssignmentsInClass = [],
                             visibleStudents = [],
                             grades = {},
                             subjectFilter = '',
                             selectedClassId = '',
                             classOwnerEmail = '',
                             onAssignmentCreate,
                             onAssignmentUpdate,
                             onAssignmentDelete,
                             userRole = 'teacher',
                             sessionDisplayName = '',
                             sessionEmail = '',
                             maxContinuousPoints = 40,
                             maxFinalPoints = 60,
                             canCreateAssignments = true,
                             schemeLockMessage = '',
                             completionType = 'CrEx', // 'Cr' (credit only) or 'CrEx' (credit + exam)
                           }) => {
  const { user } = useAuth();
  const { notify } = useToasts();
  const toastLocks = useRef({});
  const guardedNotify = useCallback((key, type, message, opts = {}) => {
    if (key) {
      const now = Date.now();
      const lock = opts.lockMs ?? 2600;
      const prev = toastLocks.current[key] ?? 0;
      if (now - prev < lock) return;
      toastLocks.current[key] = now;
    }
    notify(type, message, opts);
  }, [notify]);
  const teacherEmail = (user?.email || sessionEmail || '').toLowerCase();
  const isTeacher = (user?.role || userRole) === 'teacher';

  const [isCreating, setIsCreating] = useState(false);
  useEffect(() => {
    if (!canCreateAssignments && isCreating) {
      setIsCreating(false);
    }
  }, [canCreateAssignments, isCreating]);
  const [createForm, setCreateForm] = useState({
    name: '',
    category: 'continuous',
    totalPoints: '',
    dueDate: '',
    description: '',
  });
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'continuous',
    totalPoints: '',
    dueDate: '',
    description: '',
  });
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (!isCreating) setCreateError('');
  }, [isCreating]);

  useEffect(() => {
    if (editingId == null) setEditError('');
  }, [editingId]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const listRef = useRef(null);
  const lastScrollTop = useRef(0);
  const rafId = useRef(0);

  const rememberScroll = () => {
    const el = listRef.current;
    if (!el) return;
    lastScrollTop.current = el.scrollTop;
  };

  const restoreScroll = () => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    const y = lastScrollTop.current;
    rafId.current = requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      el.scrollTop = y;
    });
  };

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // Determine if course allows exam based on completion type
  // 'Cr' = Credit only (zapocet), 'CrEx' = Credit + Exam
  const isCreditOnly = useMemo(() => {
    const ct = String(completionType || '').toLowerCase().trim();
    // If completionType is 'cr', 'credit', 'zapocet', or similar - exam is NOT allowed
    // If completionType is 'crex', 'creditexam', 'credit+exam', or similar - exam IS allowed
    if (!ct || ct === 'crex' || ct === 'creditexam' || ct.includes('exam') || ct.includes('skúška') || ct.includes('skuska')) {
      return false; // Exam allowed
    }
    return true; // Credit only - no exam
  }, [completionType]);

  // Restrict categories based on course completion type
  const categoryOptions = useMemo(() => {
    const opts = [{ value: 'continuous', label: 'Continuous Assignment' }];
    if (!isCreditOnly) {
      opts.push({ value: 'exam', label: 'Exam Assignment' });
    }
    return opts;
  }, [isCreditOnly]);

  const getCategoryTone = (category) => {
    const m = {
      continuous: 'bg-primary/10 text-primary',
      exam: 'bg-warning/10 text-warning',
    };
    return m[category] || 'bg-muted text-muted-foreground';
  };

  const resolveOwnerEmail = (a) => (a?.teacherEmail || classOwnerEmail || '').toLowerCase();

  const canManage = (a) => {
    if (!isTeacher) return false;
    const owner = resolveOwnerEmail(a);
    if (!owner) return !!teacherEmail;
    return owner === teacherEmail;
  };

  const calcAssignmentStats = (assignment) => {
    const total = visibleStudents.length;
    if (total === 0) return { submitted: 0, total: 0, averageScore: 0, completionRate: 0 };
    let submitted = 0;
    let sumPct = 0;
    for (const s of visibleStudents) {
      const key = `${s.id}-${assignment.id}`;
      const g = grades[key];
      if (g && typeof g.percentage === 'number') {
        submitted += 1;
        sumPct += g.percentage;
      }
    }
    const averageScore = submitted > 0 ? Math.round(sumPct / submitted) : 0;
    const completionRate = Math.round((submitted / total) * 100);
    return { submitted, total, averageScore, completionRate };
  };

  const val = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);

  const handleCreateChange = (field, value) => {
    const next = { ...createForm, [field]: value };
    setCreateForm(next);
  };

  // Caps & usage helpers
  const maxContinuous = Number.isFinite(maxContinuousPoints) ? maxContinuousPoints : 40;
  const maxFinal = Number.isFinite(maxFinalPoints) ? maxFinalPoints : 60;
  const usedByCategory = (cat, skipId = null) => {
    return (allAssignmentsInClass && allAssignmentsInClass.length ? allAssignmentsInClass : assignments || [])
        .filter((a) => a && a.category === cat && a.id !== skipId)
        .reduce((s, a) => s + (Number(a.totalPoints) || 0), 0);
  };
  const remainingFor = (cat, skipId = null) => {
    const used = usedByCategory(cat, skipId);
    if (cat === 'continuous') return maxContinuous - used;
    if (cat === 'exam') return maxFinal - used;
    return Infinity;
  };

  const submitCreate = (e) => {
    e?.preventDefault();
    setCreateError('');
    if (!createForm?.name?.trim() || !createForm?.totalPoints || !createForm?.dueDate) {
      const message = 'Please fill in all required fields before creating an assignment.';
      setCreateError(message);
      guardedNotify('assign-create-missing', 'warning', message, { title: 'Missing fields', lockMs: 3200 });
      return;
    }
    // validate category and caps
    const cat = createForm.category === 'exam' ? 'exam' : 'continuous';
    const totalPts = parseFloat(createForm.totalPoints);
    const maxLeft = remainingFor(cat);
    if (Number.isFinite(totalPts) && totalPts > maxLeft) {
      const message = `The ${cat === 'continuous' ? 'Continuous' : 'Exam'} assignment exceeds the remaining cap. Points left: ${Math.max(0, Math.floor(maxLeft))}.`;
      setCreateError(message);
      guardedNotify('assign-create-cap', 'error', message, { title: 'Point cap reached', lockMs: 3200 });
      return;
    }
    if (!teacherEmail) {
      const message = 'No teacher email in session. Please sign in again.';
      setCreateError(message);
      guardedNotify('assign-create-session', 'error', message, { title: 'Session expired', lockMs: 3200 });
      return;
    }
    const trimmedName = createForm.name.trim();
    const assignmentData = {
      ...createForm,
      category: cat,
      totalPoints: totalPts,
      id: maisId('asg', `${selectedClassId}|${createForm.name}|${createForm.dueDate}`),
      classId: selectedClassId,
      teacherEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onAssignmentCreate?.(assignmentData);
    setCreateForm({ name: '', category: 'continuous', totalPoints: '', dueDate: '', description: '' });
    setIsCreating(false);
    setTimeout(() => {
    notify('success', `${trimmedName || 'Assignment'} created`, { title: 'Assignment created' });
    }, 300);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setEditForm({
      name: a?.name || '',
      category: a?.category === 'exam' ? 'exam' : 'continuous',
      totalPoints: a?.totalPoints?.toString() || '',
      dueDate: a?.dueDate?.split('T')?.[0] || a?.dueDate || '',
      description: a?.description || '',
    });
  };

  const cancelEdit = () => setEditingId(null);

  const submitEdit = (e) => {
    e?.preventDefault();
    setEditError('');
    if (!editForm?.name?.trim() || !editForm?.totalPoints || !editForm?.dueDate) {
      const message = 'Please fill in all required fields before saving changes.';
      setEditError(message);
      guardedNotify('assign-edit-missing', 'warning', message, { title: 'Missing fields', lockMs: 3200 });
      return;
    }
    const existing = assignments?.find((x) => x.id === editingId);
    if (!canManage(existing)) {
      const message = 'You do not have permission to edit this assignment.';
      setEditError(message);
      guardedNotify('assign-edit-permission', 'error', message, { title: 'Permission denied', lockMs: 3200 });
      return;
    }
    const cat = editForm.category === 'exam' ? 'exam' : 'continuous';
    const totalPts = parseFloat(editForm.totalPoints);
    const maxLeft = remainingFor(cat, editingId);
    if (Number.isFinite(totalPts) && totalPts > maxLeft) {
      const message = `The ${cat === 'continuous' ? 'Continuous' : 'Exam'} assignment exceeds the remaining cap. Points left: ${Math.max(0, Math.floor(maxLeft))}.`;
      setEditError(message);
      guardedNotify('assign-edit-cap', 'error', message, { title: 'Point cap reached', lockMs: 3200 });
      return;
    }
    const assignmentData = {
      id: editingId,
      classId: selectedClassId,
      name: editForm.name,
      category: cat,
      totalPoints: totalPts,
      dueDate: editForm.dueDate,
      description: editForm.description,
      teacherEmail: resolveOwnerEmail(existing) || teacherEmail,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onAssignmentUpdate?.(assignmentData);
    setEditingId(null);
    setTimeout(() => {
    notify('success', `${editForm.name || 'Assignment'} updated`, { title: 'Assignment updated' });
    }, 300);
  };

  const handleDelete = (id) => {
    const a = assignments.find((x) => x.id === id);
    if (!canManage(a)) {
      guardedNotify('assign-delete-permission', 'error', 'You do not have permission to delete this assignment.', { title: 'Permission denied', lockMs: 3200 });
      return;
    }
    if (window.confirm('Delete this assignment? All related grades will be removed.')) {
      onAssignmentDelete?.(id);
      guardedNotify('assign-delete-info', 'info', `${a?.name || 'Assignment'} deleted`, { title: 'Assignment deleted', lockMs: 3200 });
    }
  };

  useLayoutEffect(() => {
    restoreScroll();
  }, [assignments, visibleStudents, subjectFilter]);

  const visibleList = useMemo(() => assignments, [assignments]);

  const formatOwner = (ownerEmail) => {
    if (!ownerEmail) return '—';
    if (sessionEmail && ownerEmail.toLowerCase() === sessionEmail.toLowerCase() && sessionDisplayName) {
      return sessionDisplayName;
    }
    return ownerEmail;
  };

  const MobileSheet = ({ open, onClose, title, children }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <div className="glass-pop w-full sm:w-[560px] max-h-[80vh] overflow-auto rounded-t-xl sm:rounded-xl p-4 relative z-10 thin-scrollbar">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-foreground">{title}</div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <Icon name="X" size={14} />
              </Button>
            </div>
            {children}
          </div>
        </div>
    );
  };

  const CreateForm = (
      <form onSubmit={submitCreate} className="space-y-4">
        {createError && (
            <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
              {createError}
            </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
              label="Assignment Name"
              value={createForm.name}
              onChange={(e) => handleCreateChange('name', e.target.value)}
              placeholder="Enter assignment name"
              required
          />
          <Select
              label="Category"
              options={categoryOptions}
              value={createForm.category}
              onChange={(v) => handleCreateChange('category', val(v))}
          />
          <Input
              label="Total Points"
              type="number"
              value={createForm.totalPoints}
              onChange={(e) => handleCreateChange('totalPoints', e.target.value)}
              placeholder="100"
              min="1"
              step="0.1"
              required
          />
          <Input
              label="Due Date"
              type="date"
              value={createForm.dueDate}
              onChange={(e) => handleCreateChange('dueDate', e.target.value)}
              required
          />
        </div>
        <Textarea
            label="Description (Optional)"
            value={createForm.description}
            onChange={(e) => handleCreateChange('description', e.target.value)}
            placeholder="Assignment description or instructions"
            minRows={3}
        />
        <div className="text-xs text-muted-foreground">
          <span className="inline-block mr-3">Continuous used: {usedByCategory('continuous')}/{maxContinuous} pts</span>
          <span className="inline-block">Exam used: {usedByCategory('exam')}/{maxFinal} pts</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Owner: <span className="text-foreground" title={teacherEmail || ''}>{sessionDisplayName || teacherEmail || '—'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="default">Create</Button>
            <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
          </div>
        </div>
      </form>
  );

  const EditForm = (a) => (
      <form onSubmit={submitEdit} className="space-y-3">
        {editError && (
            <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
              {editError}
            </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
              label="Assignment Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
          />
          <Select
              label="Category"
              options={categoryOptions}
              value={editForm.category}
              onChange={(v) => setEditForm({ ...editForm, category: val(v) })}
          />
          <Input
              label="Total Points"
              type="number"
              value={editForm.totalPoints}
              onChange={(e) => setEditForm({ ...editForm, totalPoints: e.target.value })}
              min="1"
              step="0.1"
              required
          />
          <Input
              label="Due Date"
              type="date"
              value={editForm.dueDate}
              onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
              required
          />
        </div>
        <Textarea
            label="Description (Optional)"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            minRows={3}
        />
        <div className="text-[11px] text-muted-foreground">
          <span className="inline-block mr-3">Continuous used: {usedByCategory('continuous', a?.id)}/{maxContinuous} pts</span>
          <span className="inline-block">Exam used: {usedByCategory('exam', a?.id)}/{maxFinal} pts</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Owner: <span className="text-foreground" title={resolveOwnerEmail(a) || ''}>{formatOwner(resolveOwnerEmail(a))}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="default">Save</Button>
            <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>
          </div>
        </div>
      </form>
  );

  return (
      <section className="w-full">
        <div className="glass-card rounded-lg border border-border overflow-hidden shadow-card w-full">
          <div className="p-4 md:p-6 border-b border-border bg-surface/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Assignment Management</h3>
                <p className="text-sm text-muted-foreground mt-1">Create and manage assignments for your class</p>
              </div>
              {isTeacher && (
                  <div className="flex flex-col items-end gap-1 text-right">
                    <div className="flex gap-2">
                      <Button
                          variant="default"
                          iconName={isCreating ? 'Minus' : 'Plus'}
                          onClick={() => setIsCreating((v) => !v)}
                          disabled={!canCreateAssignments}
                          title={!canCreateAssignments && schemeLockMessage ? schemeLockMessage : undefined}
                      >
                        {isCreating ? 'Close' : 'New Assignment'}
                      </Button>
                    </div>
                    {!canCreateAssignments && schemeLockMessage && (
                        <div className="flex items-center gap-1 text-xs text-warning">
                          <Icon name="Lock" size={14} className="text-warning" />
                          <span>{schemeLockMessage}</span>
                        </div>
                    )}
                  </div>
              )}
            </div>
          </div>

          {isCreating && (
              <>
                {!isMobile && (
                    <div className="px-4 md:px-6 pt-4 pb-2 border-b border-border bg-muted/30">
                      {CreateForm}
                    </div>
                )}
                {isMobile && (
                    <MobileSheet open={isCreating} onClose={() => setIsCreating(false)} title="New Assignment">
                      {CreateForm}
                    </MobileSheet>
                )}
              </>
          )}

          <div
              ref={listRef}
              className="divide-y divide-border max-h-[70vh] overflow-auto will-change-scroll thin-scrollbar"
              onScroll={rememberScroll}
          >
            {visibleList?.length === 0 ? (
                <div className="p-8 text-center">
                  <Icon name="BookOpen" size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h4 className="text-lg font-medium text-foreground mb-2">No Assignments</h4>
                  <p className="text-muted-foreground mb-4">Create your first assignment to start tracking student grades</p>
                  {isTeacher && (
                      <Button
                          variant="default"
                          iconName="Plus"
                          onClick={() => setIsCreating(true)}
                          disabled={!canCreateAssignments}
                          title={!canCreateAssignments && schemeLockMessage ? schemeLockMessage : undefined}
                      >
                        Create Assignment
                      </Button>
                  )}
                </div>
            ) : (
                visibleList.map((a) => {
                  const stats = calcAssignmentStats(a);
                  const isOverdue = a?.dueDate ? new Date(a.dueDate) < new Date() : false;
                  const isEditingCard = editingId === a.id;
                  const allowed = canManage(a);
                  const ownerEmailResolved = resolveOwnerEmail(a);
                  const ownerLabel = formatOwner(ownerEmailResolved);

                  return (
                      <div key={a.id} className="p-4 md:p-6 hover:bg-muted/30 transition-colors duration-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h4 className="text-lg font-medium text-foreground truncate">{a.name}</h4>
                              <span className={`px-2 py-1 text-xs rounded-full ${getCategoryTone(a.category)}`}>{a.category}</span>
                              {isOverdue && <span className="px-2 py-1 text-xs rounded-full bg-error/10 text-error">Overdue</span>}
                              {!allowed && <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">Read-only</span>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon name="Calendar" size={16} />
                                <span className="truncate">Due: {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}</span>
                              </div>
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon name="Target" size={16} />
                                <span className="truncate">{a.totalPoints} points</span>
                              </div>
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon name="Users" size={16} />
                                <span className="truncate">{stats.submitted}/{stats.total} submitted</span>
                              </div>
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon name="AtSign" size={16} />
                                <span className="truncate" title={ownerEmailResolved || ''}>{ownerLabel}</span>
                              </div>
                            </div>

                            {a?.description && <p className="text-sm text-muted-foreground mt-2">{a.description}</p>}

                            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                        <span className="text-muted-foreground">
                          Avg Grade: <span className="font-medium text-foreground">{stats.averageScore}%</span>
                        </span>
                              <span className="text-muted-foreground">
                          Completion: <span className="font-medium text-foreground">{stats.completionRate}%</span>
                        </span>
                            </div>

                            {!isMobile && isEditingCard && allowed && (
                                <div className="mt-4 p-4 rounded-md border border-border bg-muted/30">
                                  {EditForm(a)}
                                </div>
                            )}
                          </div>

                          {isTeacher && (
                              <div className="flex items-center gap-2 shrink-0">
                                {editingId === a.id ? (
                                    <Button variant="ghost" size="icon" iconName="X" onClick={cancelEdit} title="Close editor" />
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        iconName="Edit"
                                        onClick={() => canManage(a) && openEdit(a)}
                                        title={canManage(a) ? 'Edit assignment' : 'You are not the owner'}
                                        disabled={!canManage(a)}
                                    />
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    iconName="Trash2"
                                    onClick={() => handleDelete(a.id)}
                                    title={canManage(a) ? 'Delete assignment' : 'You are not the owner'}
                                    className={`hover:bg-error/10 ${canManage(a) ? 'text-error hover:text-error' : 'text-muted-foreground'}`}
                                    disabled={!canManage(a)}
                                />
                              </div>
                          )}
                        </div>

                        {isMobile && isEditingCard && allowed && (
                            <MobileSheet open={isEditingCard} onClose={cancelEdit} title="Edit Assignment">
                              {EditForm(a)}
                            </MobileSheet>
                        )}
                      </div>
                  );
                })
            )}
          </div>
        </div>
      </section>
  );
};

export default AssignmentManager;