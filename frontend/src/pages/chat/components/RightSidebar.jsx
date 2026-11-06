// src/pages/chat/components/RightSidebar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Textarea from '../../../components/ui/Textarea';
import Icon from '../../../components/AppIcon';
import { loadProfile } from '../../profile/utils/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { resourceCache } from '../../../data/resourceCache';
import { displayNameFrom } from '../../../utils/displayName';
import { initialsFrom, GEMINI, hasGemini, stripTitlesFrom } from '../utils/chatUtils';
import chatApi from '../../../data/chatApi';
import { extractApiErrorMessage } from '../../../utils/apiErrors';
import { Checkbox } from '../../../components/ui/Checkbox';

const norm = (value = '') => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const roleLabel = (role) => (role === 'ai' ? 'AI' : role === 'faculty' ? 'Faculty' : 'Student');

const PersonRow = ({ name, right, action, onClick }) => {
  const badge = initialsFrom(name);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`w-full text-left px-2 py-1.5 text-sm ${onClick ? 'hover:bg-muted' : ''} flex items-center gap-2`}
        onClick={onClick}
      >
        <span className="w-5 h-5 rounded-full bg-primary/20 grid place-items-center text-[10px] font-semibold">
          {badge === '?' ? '' : badge}
        </span>
        <span className="truncate">{name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{right}</span>
      </button>
      {action}
    </div>
  );
};

const RightSidebar = ({
  thread,
  onInsertToComposer,
  onSendToChat,
  onUpdateThread,
  isOwner,
  currentUserRole,
}) => {
  const [announce, setAnnounce] = useState('');
  const [quick, setQuick] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const [studentDirectory, setStudentDirectory] = useState([]);
  const [facultyDirectory, setFacultyDirectory] = useState([]);

  const [aiSettings, setAiSettings] = useState(null);
  const [aiEnabledDraft, setAiEnabledDraft] = useState(false);
  const [aiModelDraft, setAiModelDraft] = useState('');
  const [aiKeyDraft, setAiKeyDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);

  const { user, userProfile } = useAuth();
  const primaryEmail = user?.email || userProfile?.email || '';
  const selfProfile = useMemo(() => {
    if (!user && !userProfile) return null;
    const fullName = userProfile?.full_name || user?.full_name || '';
    return {
      ...(userProfile || {}),
      fullName,
      name: fullName || user?.name || '',
      email: userProfile?.email || user?.email || '',
    };
  }, [user, userProfile]);
  const authEmail = String(primaryEmail || selfProfile?.email || '').toLowerCase();
  const isTeacher = (currentUserRole || '').toLowerCase() === 'teacher';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const students = await resourceCache.getStudents({ page: 1, pageSize: 500, sort: 'fullName', order: 'asc' });
        if (!cancelled) setStudentDirectory(Array.isArray(students) ? students : []);
      } catch {
        if (!cancelled) setStudentDirectory([]);
      }
      try {
        const faculty = await resourceCache.getFaculty();
        if (!cancelled) setFacultyDirectory(Array.isArray(faculty) ? faculty : []);
      } catch {
        if (!cancelled) setFacultyDirectory([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    setAiError('');
    setAiSuccess('');
    setAiEnabledDraft(!!thread?.aiEnabled);
    setAiModelDraft('');

    if (!thread?.id || !isOwner) {
      setAiSettings(null);
      return () => { ignore = true; };
    }

    setAiLoading(true);
    chatApi.getAiSettings(thread.id)
      .then((settings) => {
        if (ignore) return;
        setAiSettings(settings);
        setAiEnabledDraft(!!settings?.aiEnabled);
        setAiModelDraft(settings?.model || '');
      })
      .catch((error) => {
        if (ignore) return;
        setAiError(extractApiErrorMessage(error, 'Unable to load AI settings.'));
      })
      .finally(() => {
        if (!ignore) setAiLoading(false);
      });

    return () => { ignore = true; };
  }, [isOwner, thread?.id]);

  const sById = useMemo(() => {
    const map = new Map();
    (studentDirectory || []).forEach((s) => {
      const id = s.id || (s.email ? `stu:${s.email}` : null);
      if (!id) return;
      map.set(id, s);
    });
    return map;
  }, [studentDirectory]);

  const fById = useMemo(() => {
    const map = new Map();
    (facultyDirectory || []).forEach((f) => {
      const id = f.id || (f.email ? `fac:${f.email}` : null);
      if (!id) return;
      map.set(id, f);
    });
    return map;
  }, [facultyDirectory]);

  const personEmail = (participant) => {
    if (!participant) return '';
    const id = String(participant.id || '');
    if (id.includes('@')) return id.split(':')[1]?.toLowerCase() || '';
    return String(fById.get(id)?.email || sById.get(id)?.email || participant.email || '').toLowerCase();
  };

  const resolveDisplayName = (participant) => {
    if (!participant) return '';
    if (participant.role === 'ai') return 'Gemini';

    const id = String(participant.id || '');
    const baseFromParticipant = stripTitlesFrom(participant.name || '');
    const email = personEmail(participant);

    if (email && email === authEmail) {
      if (baseFromParticipant) return baseFromParticipant;
      const src = id.startsWith('fac:') ? fById.get(id) : id.startsWith('stu:') ? sById.get(id) : null;
      const candidate = src ? displayNameFrom(src, { privacy: false }) : (selfProfile?.fullName || selfProfile?.name);
      return stripTitlesFrom(candidate || baseFromParticipant || '');
    }

    const source = (participant.role === 'faculty' ? fById.get(id) : sById.get(id)) || fById.get(id) || sById.get(id);
    const candidate = source ? displayNameFrom(source, { privacy: false }) : null;
    return stripTitlesFrom(candidate || baseFromParticipant || '');
  };

  const canonicalKey = (participant) => personEmail(participant) || String(participant?.id || '').toLowerCase();

  const peopleIndex = useMemo(() => {
    const map = new Map();
    studentDirectory.forEach((student) => {
      const id = student.id || (student.email ? `stu:${student.email}` : null);
      if (!id) return;
      const email = String(student.email || '').toLowerCase();
      const name = stripTitlesFrom(displayNameFrom(student, { privacy: false }));
      map.set(email, { id, name, role: 'student', email });
    });
    facultyDirectory.forEach((faculty) => {
      const id = faculty.id || (faculty.email ? `fac:${faculty.email}` : null);
      if (!id) return;
      const email = String(faculty.email || '').toLowerCase();
      const name = stripTitlesFrom(displayNameFrom(faculty, { privacy: false }));
      const entity = { id, name, role: 'faculty', email };
      if (!map.has(email) || map.get(email).role !== 'faculty') {
        map.set(email, entity);
      }
    });
    return Array.from(map.values()).sort((a, b) => norm(a.name).localeCompare(norm(b.name)));
  }, [facultyDirectory, studentDirectory]);

  const query = norm(search);
  const filteredMatches = useMemo(() => {
    let list = peopleIndex;
    if (!isTeacher) {
      list = list.filter((person) => person.role === 'student');
    } else if (filterRole !== 'all') {
      list = list.filter((person) => (filterRole === 'students' ? person.role === 'student' : person.role === 'faculty'));
    }
    if (query) {
      list = list.filter((person) => norm(person.name).includes(query));
    }
    return list.slice(0, 50);
  }, [filterRole, isTeacher, peopleIndex, query]);

  const participantsSorted = useMemo(() => {
    if (!thread?.participants) return [];
    const seen = new Map();
    thread.participants.forEach((participant) => {
      const key = canonicalKey(participant);
      if (!key) return;
      const normalized = { ...participant, name: resolveDisplayName(participant) };
      if (!seen.has(key)) seen.set(key, normalized);
      else {
        const current = seen.get(key);
        const prefer = participant.role === 'faculty' && current.role !== 'faculty';
        seen.set(key, prefer ? normalized : current);
      }
    });
    return Array.from(seen.values());
  }, [thread?.participants, fById, sById]);

  const ownerId = thread?.ownerId || thread?.ownerEmail || '';
  const hasServerKey = !!aiSettings?.hasKey;

  const handleAddParticipant = (participant) => {
    if (!thread || !isTeacher) return;
    onUpdateThread?.({
      participants: [
        ...(thread.participants || []),
        { id: participant.id, role: participant.role, email: participant.email, name: participant.name }
      ]
    });
  };

  const handleSaveAiSettings = async () => {
    if (!thread?.id || !isOwner) return;
    setAiLoading(true);
    setAiError('');
    setAiSuccess('');
    try {
      await chatApi.updateAiSettings(thread.id, {
        aiEnabled: aiEnabledDraft,
        model: aiModelDraft || null,
        apiKey: aiKeyDraft.length ? aiKeyDraft : null
      });
      onUpdateThread?.({ aiEnabled: aiEnabledDraft });
      setAiKeyDraft('');
      setAiSuccess('AI settings updated.');
      const refreshed = await chatApi.getAiSettings(thread.id);
      setAiSettings(refreshed);
    } catch (error) {
      setAiError(extractApiErrorMessage(error, 'Unable to update AI settings.'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleClearAiKey = async () => {
    if (!thread?.id || !isOwner) return;
    setAiKeyDraft('');
    setAiLoading(true);
    setAiError('');
    setAiSuccess('');
    try {
      await chatApi.updateAiSettings(thread.id, { aiEnabled: aiEnabledDraft, model: aiModelDraft || null, apiKey: '' });
      onUpdateThread?.({ aiEnabled: aiEnabledDraft });
      const refreshed = await chatApi.getAiSettings(thread.id);
      setAiSettings(refreshed);
      setAiSuccess('API key removed.');
    } catch (error) {
      setAiError(extractApiErrorMessage(error, 'Unable to clear AI key.'));
    } finally {
      setAiLoading(false);
    }
  };

  if (!thread) {
    return <div className="p-4 text-sm text-muted-foreground">Select or create a chat to see details.</div>;
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="p-4 sm:p-6 border-b border-border">
        <div className="text-xs text-muted-foreground mb-2">Thread title</div>
        <Input
          value={thread.title || ''}
          onChange={(e) => { if (isOwner) onUpdateThread?.({ title: e.target.value }); }}
          placeholder="Untitled chat"
          disabled={!isOwner}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6 thin-scrollbar">
        {isOwner && (
          <section>
            <h4 className="text-sm font-semibold mb-3 text-foreground">AI assistant</h4>
            
            {/* Show setup prompt when no key is stored and form is not open */}
            {!hasServerKey && !showApiKeyForm && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Icon name="Key" size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground mb-1">API key required</div>
                    <div className="text-xs text-muted-foreground mb-3">
                      To use AI assistant, you need to configure your Gemini API key. 
                      Get a free key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>.
                    </div>
                    <Button size="sm" iconName="Settings" onClick={() => setShowApiKeyForm(true)}>
                      Configure API key
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show full form when key exists OR user clicked to configure */}
            {(hasServerKey || showApiKeyForm) && (
              <>
                <div className="flex flex-wrap items-start gap-3 mb-3">
                  <Checkbox
                    checked={aiEnabledDraft}
                    onChange={(e) => setAiEnabledDraft(!!e?.target?.checked)}
                    disabled={aiLoading}
                    label="Enable Gemini assistant"
                    description="Allow Gemini to assist in this chat."
                    className="flex-1 min-w-[200px]"
                  />
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${hasServerKey ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hasServerKey ? '#16a34a' : '#d97706' }} />
                    {hasServerKey ? 'Key stored' : 'Key not set'}
                  </span>
                </div>
                <Input
                  type="text"
                  label="Model (optional)"
                  placeholder="gemini-2.0-flash"
                  value={aiModelDraft}
                  onChange={(e) => setAiModelDraft(e.target.value)}
                  disabled={aiLoading}
                />
                <Input
                  type="password"
                  label="Gemini API key"
                  placeholder={hasServerKey ? '••••••••••••••••' : 'Paste your API key'}
                  value={aiKeyDraft}
                  onChange={(e) => setAiKeyDraft(e.target.value)}
                  disabled={aiLoading}
                  className="mt-3"
                />
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" onClick={handleSaveAiSettings} disabled={aiLoading}>
                    {aiLoading ? 'Saving…' : 'Save'}
                  </Button>
                  {hasServerKey && (
                    <Button size="sm" variant="outline" onClick={handleClearAiKey} disabled={aiLoading}>
                      Clear key
                    </Button>
                  )}
                  {!hasServerKey && showApiKeyForm && (
                    <Button size="sm" variant="ghost" onClick={() => setShowApiKeyForm(false)} disabled={aiLoading}>
                      Cancel
                    </Button>
                  )}
                </div>
                {aiError && <div className="text-xs text-rose-600 mt-2">{aiError}</div>}
                {!aiError && aiSuccess && <div className="text-xs text-green-600 mt-2">{aiSuccess}</div>}
              </>
            )}
          </section>
        )}

        {!isOwner && (
          <section>
            <h4 className="text-sm font-semibold mb-2 text-foreground">AI assistant</h4>
            <div className="text-xs text-muted-foreground">
              {thread.aiEnabled ? 'Gemini auto-replies are enabled for this chat.' : 'Gemini assistant is disabled.'}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-foreground">Participants</h4>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {(participantsSorted || []).length}
            </span>
          </div>
          {!hasGemini(thread) && isTeacher && (
            <div className="mb-2">
              <Button size="sm" variant="outline" iconName="Sparkles" onClick={() => onUpdateThread?.({ participants: [...(thread.participants || []), GEMINI] })}>
                Add Gemini (AI)
              </Button>
            </div>
          )}
          {(participantsSorted || []).length === 0 ? (
            <div className="text-xs text-muted-foreground mb-2">No participants yet.</div>
          ) : (
            <div className="space-y-1 mb-3">
              {participantsSorted.map((participant) => {
                const email = personEmail(participant);
                const isOwnerParticipant = participant.id === ownerId || email === (thread.ownerEmail || '').toLowerCase();
                return (
                  <PersonRow
                    key={participant.id}
                    name={participant.role === 'ai' ? 'Gemini' : stripTitlesFrom(participant.name || '')}
                    right={isOwnerParticipant ? 'Owner' : roleLabel(participant.role)}
                    action={isTeacher && participant.role !== 'ai' ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        iconName="X"
                        title="Remove"
                        onClick={() => onUpdateThread?.({
                          participants: (thread.participants || []).filter((p) => canonicalKey(p) !== canonicalKey(participant))
                        })}
                      />
                    ) : null}
                    onClick={() => {
                      if (!isOwner || participant.role === 'ai') return;
                      onUpdateThread?.({ ownerEmail: email });
                    }}
                  />
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <Input
              placeholder={isTeacher ? 'Find student or teacher…' : 'Find student…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isTeacher && (
            <div className="flex items-center gap-2 mb-2">
              <Button size="xs" variant={filterRole === 'all' ? 'default' : 'outline'} onClick={() => setFilterRole('all')}>All</Button>
              <Button size="xs" variant={filterRole === 'students' ? 'default' : 'outline'} onClick={() => setFilterRole('students')}>Students</Button>
              <Button size="xs" variant={filterRole === 'faculty' ? 'default' : 'outline'} onClick={() => setFilterRole('faculty')}>Faculty</Button>
            </div>
          )}
          {!!filteredMatches.length && (
            <div className="max-h-56 overflow-auto rounded border border-border thin-scrollbar">
              {filteredMatches.map((person) => (
                <PersonRow
                  key={person.id}
                  name={person.name}
                  right={<span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{roleLabel(person.role)}</span>}
                  onClick={() => handleAddParticipant(person)}
                />
              ))}
            </div>
          )}
          {!filteredMatches.length && (
            <div className="text-xs text-muted-foreground">No matches.</div>
          )}
        </section>

        <section>
          <h4 className="text-sm font-semibold mb-3 text-foreground">Quick templates</h4>
          <div className="grid grid-cols-1 gap-2">
            {[
              'Quick reminder: homework is due tomorrow.',
              'Please check the rubric attached in LMS.',
              'Let’s move the quiz to Friday. Works?',
              'I will share project feedback by Monday.'
            ].map((text) => (
              <button
                key={text}
                type="button"
                className="text-left text-sm px-2 py-1.5 rounded border border-border hover:bg-muted"
                onClick={() => onInsertToComposer?.(text)}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Input
              placeholder="Write your own template…"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => { if (quick.trim()) { onInsertToComposer?.(quick.trim()); setQuick(''); } }}
            >
              Insert
            </Button>
          </div>
        </section>

        <section>
          <h4 className="text-sm font-semibold mb-3 text-foreground">Announcement</h4>
          <Textarea
            minRows={3}
            resize="none"
            value={announce}
            onChange={(e) => setAnnounce(e.target.value)}
            placeholder="Broadcast a message to the thread…"
            textareaClassName="text-sm"
          />
          <div className="mt-2 flex items-center justify-start gap-2">
            <Button
              size="sm"
              iconName="Megaphone"
              onClick={() => { if (announce.trim()) { onSendToChat?.(announce.trim(), true); setAnnounce(''); } }}
            >
              Send announcement
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RightSidebar;

