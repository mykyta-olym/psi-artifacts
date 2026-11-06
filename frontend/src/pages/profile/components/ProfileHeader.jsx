// src/pages/profile/components/ProfileHeader.jsx
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import Avatar from '../../../components/ui/Avatar';
import useUserPreference from '../../../hooks/useUserPreference';
import { STORAGE_KEY as STUDY_STORAGE_KEY } from '../../study-selection/utils/studyUtils';
function degreeFrom(rec = {}) {
    const d = String(rec.degree || '').toLowerCase();
    const code = String(rec.programCode || '').toLowerCase();
    if (d.includes('ing') || /_ing_/.test(code)) return 'Ing';
    if (d.includes('bc') || /_bc_/.test(code)) return 'Bc';
    return '';
}
function formatStudySubtitle(rec = {}) {
    const name = rec.programName || rec.programCode || '';
    const fac = rec.faculty || '';
    const yr = String(rec.ospYear || '').trim();
    const deg = degreeFrom(rec);
    const yearLabel = yr ? `${yr}. rok` : '';
    const degLabel = deg === 'Ing' ? 'Ing.' : '';
    return [name, fac, yearLabel, degLabel].filter(Boolean).join(', ');
}

const ProfileHeader = ({
                           privacy,
                           togglePrivacy,
                           avatarDataUrl,
                           onPickAvatar,
                           fileInputRef,
                           handleAvatarPick,
                           fullName,
                           profileRole,
                           isTeacher,
                           department,
                           about,
                           isEditing,
                           startEdit,
                           cancelEdit,
                           saving,
                           handleSave,
                           exportProfileJSON,
                           exportOfficeHoursICS,
                           identifier,
                           identifierLabel = 'ID',
                       }) => {
    const teacherSubtitle = department || 'Department not set';
    const selectedStudyPreference = useUserPreference(STUDY_STORAGE_KEY, null);
    const selectedStudy = selectedStudyPreference.value;
    const computedStudent = selectedStudy ? formatStudySubtitle(selectedStudy) : '';
    const fallbackStudent = about && about.trim().length > 0 ? about.trim() : '';
    const studentSubtitle = privacy ? '' : (computedStudent || fallbackStudent);
    const subtitle = privacy ? '••••••••' : isTeacher ? teacherSubtitle : studentSubtitle;
    const showIdentifier = !!identifier && !privacy;
    const isStudent = !isTeacher && String(profileRole).toLowerCase() === 'student';

    const resetStudyPreserveRemember = useCallback(() => {
        selectedStudyPreference.reset();
    }, [selectedStudyPreference]);

    return (
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                    <Avatar name={fullName || '—'} src={avatarDataUrl || null} size={64} rounded privacy={privacy} />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onPickAvatar}
                        className="absolute -bottom-1 -right-1 rounded-full bg-primary text-primary-foreground ring-2 ring-background hover:opacity-90"
                        title="Change avatar"
                        aria-label="Change avatar"
                        iconName="Camera"
                        iconSize={14}
                    />
                    <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarPick} />
                </div>

                <div className="min-w-0">
                    <div className="text-2xl font-bold text-foreground truncate max-w-[60vw] sm:max-w-none">
                        {privacy ? obfuscate(fullName || '—') : (fullName || '—')}
                    </div>
                    {subtitle ? <div className="text-sm text-muted-foreground truncate">{subtitle}</div> : null}
                    {showIdentifier ? (
                        <div className="text-xs text-muted-foreground mt-1">
                            {identifierLabel}: <span className="font-mono lowercase">{identifier}</span>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {!isEditing ? (
                    <>
                        <Button variant="default" iconName="Edit3" onClick={startEdit} className="w-full sm:w-auto" aria-label="Edit profile">
                            Edit
                        </Button>
                        {isStudent && (
                            <Link to="/study-select?return=/student-dashboard&reset=1" className="w-full sm:w-auto" onClick={resetStudyPreserveRemember}>
                                <Button variant="outline" iconName="GraduationCap" aria-label="Change study" className="w-full sm:w-auto">
                                    Change Study
                                </Button>
                            </Link>
                        )}
                    </>
                ) : (
                    <>
                        <Button variant="outline" iconName="X" onClick={cancelEdit} className="w-full sm:w-auto" aria-label="Cancel editing">
                            Cancel
                        </Button>
                        <Button variant="default" iconName={saving ? 'Loader2' : 'Save'} onClick={handleSave} disabled={saving} className="w-full sm:w-auto" aria-label="Save profile">
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </>
                )}

                <Button variant={privacy ? 'default' : 'outline'} iconName={privacy ? 'EyeOff' : 'Eye'} onClick={togglePrivacy} className="w-full sm:w-auto" aria-label={privacy ? 'Disable Privacy' : 'Enable Privacy'}>
                    <span className="sm:hidden">Privacy</span>
                    <span className="hidden sm:inline">{privacy ? 'Privacy On' : 'Privacy Off'}</span>
                </Button>

                <Button variant="outline" iconName="Download" onClick={exportProfileJSON} className="w-full sm:w-auto" aria-label="Export profile as JSON">
                    <span className="sm:hidden">JSON</span>
                    <span className="hidden sm:inline">Export JSON</span>
                </Button>

                <Button variant="outline" iconName="Calendar" onClick={exportOfficeHoursICS} className="w-full sm:w-auto" aria-label="Export office hours as ICS">
                    <span className="sm:hidden">.ics</span>
                    <span className="hidden sm:inline">Export Office Hours (.ics)</span>
                </Button>
            </div>
        </div>
    );
};

export default ProfileHeader;

function obfuscate(s) {
    if (!s) return '';
    return s.split('').map((ch, i) => (i % 2 ? '•' : ch)).join('');
}