// src/pages/resource-management/components/DepartmentModal.jsx
import React, { useState, useEffect } from 'react';
import ModalBase from '../../../components/ui/ModalBase';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { useToasts } from '../../../components/ui/Toasts';



// Auto-generate department code from name
const generateDepartmentCode = (name) => {
  if (!name || !name.trim()) return '';
  
  // Remove special characters, split by spaces
  const words = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z\s]/g, '') // Remove non-letters
    .split(/\s+/)
    .filter(w => w.length > 0);
  
  if (words.length === 0) return '';
  
  // Take first 4 letters from first word, uppercase
  const code = words[0].substring(0, 4).toUpperCase();
  return code;
};

const DepartmentModal = ({ isOpen, onClose, onSave, department, faculties = [] }) => {
  const { notify } = useToasts();
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [faculty, setFaculty] = useState('FEI');
  const [active, setActive] = useState(true);
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);

  useEffect(() => {
    if (department) {
      setName(department.name || '');
      setCode(department.code || '');
      setFaculty(department.faculty || 'FEI');
      setActive(department.active ?? true);
      setAutoGenerateCode(false); // Disable auto-generation when editing
    } else {
      setName('');
      setCode('');
      setFaculty('FEI');
      setActive(true);
      setAutoGenerateCode(true);
    }
  }, [department, isOpen]);

  // Auto-generate code when name changes (only for new departments)
  useEffect(() => {
    if (!department && autoGenerateCode && name) {
      const generatedCode = generateDepartmentCode(name);
      setCode(generatedCode);
    }
  }, [name, department, autoGenerateCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!name.trim()) {
      notify('error', 'Department name is required');
      return;
    }
    
    if (!code.trim()) {
      notify('error', 'Department code is required');
      return;
    }
    
    if (!faculty) {
      notify('error', 'Faculty is required');
      return;
    }
    
    setIsSaving(true);
    try {
      const formData = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        faculty,
        active
      };
      
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save department:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase
      open={isOpen}
      onClose={onClose}
      title={department ? 'Edit Department' : 'Create Department'}
      subtitle={department ? 'Update department information' : 'Add a new department to the system'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSaving} iconName="Save">
            {department ? 'Save Changes' : 'Create Department'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Department Name"
          required
          placeholder="e.g., Katedra počítačov a informatiky"
          value={name}
          onChange={(e) => setName(e.target.value)}
          description="Full department name"
        />

        <div>
          <Input
            label="Department Code"
            required
            placeholder="e.g., KPOC"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setAutoGenerateCode(false); // Disable auto-generation if manually edited
            }}
            disabled={!!department}
            description={
              department 
                ? "Department code cannot be changed" 
                : autoGenerateCode 
                  ? "Auto-generated from name (edit to customize)" 
                  : "Unique identifier (will be auto-uppercased)"
            }
          />
          {!department && autoGenerateCode && (
            <p className="text-xs text-primary mt-1">
              ✓ Auto-generating code from department name
            </p>
          )}
        </div>

        <Select
          label="Faculty"
          required
          options={faculties.map(f => ({
            value: f.code,
            label: `${f.code} - ${f.nameEn}`
          }))}
          value={faculty}
          onChange={setFaculty}
          searchable
          description="Faculty this department belongs to"
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
            Active Department
          </label>
        </div>
      </div>
    </ModalBase>
  );
};

export default DepartmentModal;
