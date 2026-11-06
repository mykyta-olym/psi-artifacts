// src/pages/class-schedule-management/components/ClassGroupModal.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { useToasts } from '../../../components/ui/Toasts';
import { createClassGroup, updateClassGroup } from '../../../data/maisApiAdapter';
import { extractApiErrorMessage } from '../../../utils/apiErrors';
import { createValidator, required, custom as customRule, useFormValidator } from '../../../utils/validation';

const TYPE_OPTIONS = [
  { value: '', label: 'No specific type' },
  { value: 'CL', label: 'CL - Practice Class' },
  { value: 'P', label: 'P - Lecture' },
  { value: 'S', label: 'S - Seminar' }
];

const ClassGroupModal = ({ isOpen, group = null, faculties = [], programs = [], onClose }) => {
  const { notify } = useToasts();
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [faculty, setFaculty] = useState('');
  const [program, setProgram] = useState('');
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState(30);
  const [description, setDescription] = useState('');

  // Initialize form with existing group data
  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setFaculty(group.faculty || '');
      setProgram(group.program || '');
      setType(group.type || '');
      setCapacity(group.capacity || 30);
      setDescription(group.description || '');
    }
  }, [group]);

  // Validation schema
  const validationSchema = useMemo(
    () => ({
      name: [required('Name is required')],
      faculty: [required('Faculty is required')],
      program: [required('Program is required')],
      capacity: [
        required('Capacity is required'),
        customRule('Capacity must be between 1 and 30', {
          validate: (value) => {
            const num = parseInt(value, 10);
            return !isNaN(num) && num >= 1 && num <= 30;
          }
        }),
        ...(group ? [
          customRule(`Capacity cannot be less than current student count (${group.studentCount})`, {
            validate: (value) => {
              const num = parseInt(value, 10);
              return !isNaN(num) && num >= (group.studentCount || 0);
            }
          })
        ] : [])
      ]
    }),
    [group]
  );

  const validator = createValidator(validationSchema);

  // Faculty and Program options
  const facultyOptions = useMemo(() => 
    faculties.map(f => ({ value: f, label: f })),
    [faculties]
  );

  const programOptions = useMemo(() => 
    programs.map(p => ({ value: p, label: p })),
    [programs]
  );

  // Validation helper
  const validateForm = useCallback(() => {
    const data = { name, faculty, program, capacity };
    const errors = validator(data);
    return Object.keys(errors).length === 0 ? null : errors;
  }, [name, faculty, program, capacity, validator]);

  const handleSave = useCallback(async () => {
    const errors = validateForm();
    if (errors) {
      const firstError = Object.values(errors)[0];
      notify('error', firstError);
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        faculty: faculty.trim(),
        program: program.trim(),
        type: type || null,
        capacity: parseInt(capacity, 10),
        description: description.trim() || null
      };

      if (group) {
        await updateClassGroup(group.id, data);
        notify('success', `Class group "${data.name}" updated successfully`);
      } else {
        await createClassGroup(data);
        notify('success', `Class group "${data.name}" created successfully`);
      }

      onClose(true); // Pass true to indicate successful save
    } catch (error) {
      notify('error', extractApiErrorMessage(error, group ? 'Failed to update class group' : 'Failed to create class group'));
    } finally {
      setSaving(false);
    }
  }, [name, faculty, program, type, capacity, description, group, validateForm, notify, onClose]);

  const handleClose = useCallback(() => {
    onClose(false);
  }, [onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <>
      {/* Full-screen backdrop with blur */}
      <div 
        className="fixed inset-0 z-[9998] bg-background/80 backdrop-blur-sm" 
        onClick={handleClose}
        aria-hidden="true"
      />
      
      {/* Modal container */}
      <div className="fixed inset-0 z-[9999] overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-4">
          {/* Modal content */}
          <div 
            className="relative w-full max-w-4xl bg-card shadow-2xl rounded-lg border border-border pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card rounded-t-lg">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {group ? 'Edit Class Group' : 'Create Class Group'}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {group ? 'Update class group details' : 'Configure faculty, program, and capacity (max 30 students)'}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6 max-h-[calc(100vh-250px)] overflow-y-auto">
            <div className="space-y-5">
              {/* Name */}
              <Input
                label="Name"
                required
                placeholder="e.g., 01. sk, Group A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                description="Display name for the class group"
              />

              {/* Faculty */}
              <Select
                label="Faculty"
                required
                options={facultyOptions}
                value={faculty}
                onChange={setFaculty}
                placeholder="Select faculty"
                searchable
                description="Faculty from existing records"
              />

              {/* Program */}
              <Select
                label="Program"
                required
                options={programOptions}
                value={program}
                onChange={setProgram}
                placeholder="Select program"
                searchable
                description="Study program from existing records"
              />

              {/* Type */}
              <Select
                label="Type"
                options={TYPE_OPTIONS}
                value={type}
                onChange={setType}
                description="Optional: class type (CL, P, S)"
              />

              {/* Capacity */}
              <div>
                <Input
                  label="Capacity"
                  required
                  type="number"
                  min={1}
                  max={30}
                  placeholder="30"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  description="Maximum number of students (1-30)"
                />
                {group && group.studentCount > 0 && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-amber-400/90">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Current enrollment: {group.studentCount} students. Capacity must be at least {group.studentCount}.
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Description
                  <span className="text-white/40 ml-1">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional notes or description"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/90 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Info box */}
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-sky-500/20 shrink-0">
                    <AlertCircle className="w-4 h-4 text-sky-300" />
                  </div>
                  <div className="text-xs text-sky-200/90 leading-relaxed">
                    <p className="font-semibold mb-1">Class Group Guidelines:</p>
                    <ul className="space-y-1 list-disc list-inside text-sky-200/70">
                      <li>Maximum capacity is 30 students per group</li>
                      <li>Faculty and Program are selected from existing records</li>
                      <li>Groups can only be deleted when no students are enrolled</li>
                      <li>Class type (CL, P, S) helps organize schedule events</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30 rounded-b-lg">
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving} iconName="Save">
                {group ? 'Save Changes' : 'Create Class Group'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
};

export default ClassGroupModal;
