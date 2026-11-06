// src/pages/class-schedule-management/components/ClassGroupModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import ModalBase from '../../../components/ui/ModalBase';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { useToasts } from '../../../components/ui/Toasts';
import { createClassGroup, updateClassGroup } from '../../../data/maisApiAdapter';
import { fetchFacultyOptions } from '../../../data/facultyOptionsApi';
import { fetchPrograms } from '../../../data/programsApi';
import { extractApiErrorMessage } from '../../../utils/apiErrors';

const ClassGroupModal = ({ isOpen, group = null, onClose }) => {
  const { notify } = useToasts();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [faculty, setFaculty] = useState('');
  const [program, setProgram] = useState('');
  const [capacity, setCapacity] = useState('30');
  
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [programOptions, setProgramOptions] = useState([]);
  const [allPrograms, setAllPrograms] = useState([]);

  // Load faculties and programs from API
  useEffect(() => {
    if (!isOpen) return;
    
    const loadOptions = async () => {
      setLoading(true);
      try {
        const [faculties, programs] = await Promise.all([
          fetchFacultyOptions(),
          fetchPrograms()
        ]);
        
        console.log('[ClassGroupModal] Loaded options:', { faculties, programs });
        
        const facultyOpts = (faculties || [])
          .filter(f => f && (f.code || f.nameEn || f.name)) // Only valid faculty objects
          .map(f => ({
            value: String(f.code || ''),
            label: String(f.nameEn || f.nameSk || f.name || f.code || '')
          }))
          .filter(opt => opt.value); // Remove empty values
        
        console.log('[ClassGroupModal] Processed faculty options:', facultyOpts);
        
        setFacultyOptions(facultyOpts);
        setAllPrograms(programs || []);
        
        // Set default faculty if creating new
        if (!group && facultyOpts.length > 0 && !faculty) {
          setFaculty(facultyOpts[0].value);
        }
      } catch (error) {
        console.error('[ClassGroupModal] Failed to load options:', error);
        notify('error', 'Failed to load faculty/program options');
      } finally {
        setLoading(false);
      }
    };
    
    loadOptions();
  }, [isOpen]);

  // Filter programs by selected faculty
  useEffect(() => {
    if (!faculty || !allPrograms) {
      setProgramOptions([]);
      return;
    }
    
    const filtered = allPrograms.filter(p => 
      String(p.faculty || '').toUpperCase() === faculty.toUpperCase()
    );
    
    const opts = filtered
      .filter(p => p && (p.name || p.code)) // Only valid program objects
      .map(p => {
        const option = {
          value: String(p.name || ''),
          label: String(p.name || p.code || '')
        };
        console.log('[ClassGroupModal] Mapping program:', { input: p, output: option });
        return option;
      })
      .filter(opt => opt.value && typeof opt.value === 'string' && typeof opt.label === 'string'); // Ensure strings
    
    console.log('[ClassGroupModal] Setting programOptions:', opts);
    setProgramOptions(opts);
    
    // Set default program if creating new
    if (!group && opts.length > 0 && !program) {
      setProgram(opts[0].value);
    }
  }, [faculty, allPrograms]);

  // Populate form when editing existing group
  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setFaculty(String(group.faculty || ''));
      setProgram(String(group.program || ''));
      setCapacity(String(group.capacity || 30));
    } else if (isOpen) {
      setName('');
      setCapacity('30');
      // Faculty and program will be set by the loading effects
    }
  }, [group, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      notify('error', 'Name is required');
      return;
    }

    if (!faculty) {
      notify('error', 'Faculty is required');
      return;
    }

    if (!program) {
      notify('error', 'Program is required');
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1 || capacityNum > 30) {
      notify('error', 'Capacity must be between 1 and 30');
      return;
    }

    if (group && capacityNum < (group.studentCount || 0)) {
      notify('error', `Capacity cannot be less than current student count (${group.studentCount})`);
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        faculty: faculty,
        program: program,
        capacity: capacityNum,
      };

      if (group) {
        await updateClassGroup(group.id, data);
        notify('success', 'Class group updated successfully');
      } else {
        await createClassGroup(data);
        notify('success', 'Class group created successfully');
      }

      onClose();
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to save class group'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBase
      open={isOpen}
      onClose={onClose}
      title={group ? 'Edit Class Group' : 'Create Class Group'}
      subtitle={group ? 'Update class group details' : 'Add a new class group'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} iconName="Save">
            {group ? 'Save Changes' : 'Create Group'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Group Name"
          required
          placeholder="e.g., 1.INF-A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          description="Unique name for the class group"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Faculty"
            required
            options={facultyOptions}
            value={faculty}
            onChange={(val) => {
              console.log('[ClassGroupModal] Faculty onChange:', { val, type: typeof val });
              setFaculty(String(val || ''));
              setProgram(''); // Clear program when faculty changes
            }}
            disabled={loading}
            description="Faculty assignment"
          />

          <Select
            label="Program"
            required
            options={programOptions}
            value={program}
            onChange={(val) => {
              console.log('[ClassGroupModal] Program onChange:', { val, type: typeof val });
              setProgram(String(val || ''));
            }}
            disabled={loading || !faculty || programOptions.length === 0}
            description="Study program"
          />
        </div>

        <Input
          label="Capacity"
          required
          type="number"
          min="1"
          max="30"
          placeholder="e.g., 30"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          description={group ? `Current: ${group.studentCount || 0} students` : 'Max students (1-30)'}
        />

        {group && group.studentCount > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <strong>Note:</strong> This group currently has {group.studentCount} student(s). 
            Capacity must be at least {group.studentCount}.
          </div>
        )}
      </div>
    </ModalBase>
  );
};

export default ClassGroupModal;
