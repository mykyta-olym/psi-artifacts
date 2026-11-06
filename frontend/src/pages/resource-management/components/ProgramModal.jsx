// src/pages/resource-management/components/ProgramModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import ModalBase from '../../../components/ui/ModalBase';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import { useToasts } from '../../../components/ui/Toasts';

// Auto-generate program code from name
const generateProgramCode = (name) => {
  if (!name || !name.trim()) return '';
  
  // Common words to skip
  const skipWords = ['in', 'of', 'and', 'the', 'for', 'to', 'a', 'an', 'with', 'on', 'at', 'from', 'by'];
  
  // Remove special characters, split by spaces
  const words = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z\s]/g, '') // Remove non-letters
    .split(/\s+/)
    .filter(w => w.length > 0 && !skipWords.includes(w.toLowerCase()));
  
  if (words.length === 0) return '';
  
  // Take first letter of each word, max 4 letters, uppercase
  const code = words
    .slice(0, 4)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  
  return code;
};

const ProgramModal = ({ isOpen, onClose, onSave, program, faculties, departments }) => {
  const { notify } = useToasts();
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [faculty, setFaculty] = useState('FEI');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);

  useEffect(() => {
    if (program) {
      setName(program.name || '');
      setCode(program.code || '');
      setFaculty(program.faculty || 'FEI');
      setDepartmentId(program.departmentId || '');
      setDescription(program.description || '');
      setActive(program.active ?? true);
      setAutoGenerateCode(false); // Disable auto-generation when editing
    } else {
      setName('');
      setCode('');
      setFaculty('FEI');
      setDepartmentId('');
      setDescription('');
      setActive(true);
      setAutoGenerateCode(true);
    }
  }, [program, isOpen]);

  // Auto-generate code when name changes (only for new programs)
  useEffect(() => {
    if (!program && autoGenerateCode && name) {
      const generatedCode = generateProgramCode(name);
      setCode(generatedCode);
    }
  }, [name, program, autoGenerateCode]);

  // Filter departments by selected faculty
  const availableDepartments = useMemo(() => {
    return departments.filter(d => d.faculty === faculty);
  }, [departments, faculty]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!name.trim()) {
      notify('error', 'Program name is required');
      return;
    }
    
    if (!code.trim()) {
      notify('error', 'Program code is required');
      return;
    }
    
    if (!faculty) {
      notify('error', 'Faculty is required');
      return;
    }
    
    if (!departmentId) {
      notify('error', 'Department is required');
      return;
    }
    
    setIsSaving(true);
    try {
      const formData = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        faculty,
        departmentId: departmentId || null,
        description: description?.trim() || null,
        active
      };
      
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save program:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFacultyChange = (newFaculty) => {
    setFaculty(newFaculty);
    // Reset department if faculty changes
    setDepartmentId('');
  };

  return (
    <ModalBase
      open={isOpen}
      onClose={onClose}
      title={program ? 'Edit Program' : 'Create Program'}
      subtitle={program ? 'Update program information' : 'Add a new study program to the system'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSaving} iconName="Save">
            {program ? 'Save Changes' : 'Create Program'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Program Name"
          required
          placeholder="e.g., Applied Informatics, Computer Science"
          value={name}
          onChange={(e) => setName(e.target.value)}
          description="Full program name"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Program Code"
            required
            placeholder="e.g., AINF, KPPI"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setAutoGenerateCode(false); // Disable auto-generation if manually edited
            }}
            disabled={!!program}
            description={
              program 
                ? "Program code cannot be changed" 
                : autoGenerateCode 
                  ? "Auto-generated from name (edit to customize)" 
                  : "Unique identifier (will be auto-uppercased)"
            }
          />
        </div>
        
        {!program && autoGenerateCode && (
          <p className="text-xs text-primary -mt-3">
            ✓ Auto-generating code from program name
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Faculty"
            required
            value={faculty}
            onChange={handleFacultyChange}
            options={faculties.map(f => ({
              value: f.code,
              label: `${f.code} - ${f.nameEn}`
            }))}
            searchable
            description="Faculty this program belongs to"
          />

          <Select
            label="Department"
            required
            value={departmentId}
            onChange={setDepartmentId}
            options={availableDepartments.map(d => ({
              value: d.id,
              label: d.name
            }))}
            disabled={!faculty || availableDepartments.length === 0}
            placeholder={!faculty ? "Select faculty first" : availableDepartments.length === 0 ? "No departments available" : "Select department"}
            description="Department this program belongs to (filtered by faculty)"
          />
        </div>

        <Textarea
          label="Description"
          placeholder="Optional description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <input
            type="checkbox"
            id="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
          />
          <label htmlFor="active" className="text-sm font-medium text-foreground cursor-pointer select-none">
            Active Program
          </label>
        </div>
      </div>
    </ModalBase>
  );
};

export default ProgramModal;
