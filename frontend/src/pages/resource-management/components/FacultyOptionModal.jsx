// src/pages/resource-management/components/FacultyOptionModal.jsx
import React, { useState, useEffect } from 'react';
import ModalBase from '../../../components/ui/ModalBase';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import { useToasts } from '../../../components/ui/Toasts';

const FacultyOptionModal = ({ isOpen, onClose, onSave, faculty }) => {
  const { notify } = useToasts();
  const [isSaving, setIsSaving] = useState(false);
  
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameSk, setNameSk] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (faculty) {
      setCode(faculty.code || '');
      setNameEn(faculty.nameEn || '');
      setNameSk(faculty.nameSk || '');
      setDescription(faculty.description || '');
      setActive(faculty.active ?? true);
    } else {
      setCode('');
      setNameEn('');
      setNameSk('');
      setDescription('');
      setActive(true);
    }
  }, [faculty, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!code.trim()) {
      notify('error', 'Faculty code is required');
      return;
    }
    
    if (!nameEn.trim()) {
      notify('error', 'English name is required');
      return;
    }
    
    setIsSaving(true);
    try {
      const formData = {
        code: code.trim().toUpperCase(),
        nameEn: nameEn.trim(),
        nameSk: nameSk?.trim() || null,
        description: description?.trim() || null,
        active
      };
      
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save faculty:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase
      open={isOpen}
      onClose={onClose}
      title={faculty ? 'Edit Faculty' : 'Create Faculty'}
      subtitle={faculty ? 'Update faculty information' : 'Add a new faculty to the system'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSaving} iconName="Save">
            {faculty ? 'Save Changes' : 'Create Faculty'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name (English)"
          required
          placeholder="e.g., Faculty of Electrical Engineering and Informatics"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          description="Official English name"
          autoFocus
        />

        <Input
          label="Faculty Code"
          required
          placeholder="e.g., FEI, FBERG, SjF"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={!!faculty}
          description={faculty ? "Faculty code cannot be changed" : "Unique identifier (will be auto-uppercased)"}
        />

        <Input
          label="Name (Slovak)"
          placeholder="e.g., Fakulta elektrotechniky a informatiky"
          value={nameSk}
          onChange={(e) => setNameSk(e.target.value)}
          description="Official Slovak name (optional)"
        />

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
            Active Faculty
          </label>
        </div>
      </div>
    </ModalBase>
  );
};

export default FacultyOptionModal;
