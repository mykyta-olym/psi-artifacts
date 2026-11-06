// src/pages/resource-management/components/EquipmentModal.jsx
import React, { useState, useEffect } from 'react';
import ModalBase from '../../../components/ui/ModalBase';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import { useToasts } from '../../../components/ui/Toasts';

const EQUIPMENT_TYPES = [
  { value: 'Projector', label: 'Projector' },
  { value: 'Desktop', label: 'Desktop Computer' },
  { value: 'Laptop', label: 'Laptop' },
  { value: 'Monitor', label: 'Monitor' },
  { value: 'Printer', label: 'Printer' },
  { value: 'Scanner', label: 'Scanner' },
  { value: 'VR Headset', label: 'VR Headset' },
  { value: 'Camera', label: 'Camera' },
  { value: 'Microphone', label: 'Microphone' },
  { value: 'Speaker', label: 'Speaker System' },
  { value: 'Whiteboard', label: 'Interactive Whiteboard' },
  { value: 'Core Switch', label: 'Network Switch' },
  { value: 'Router', label: 'Router' },
  { value: 'Server', label: 'Server' },
  { value: 'VC device', label: 'Video Conference Device' },
  { value: 'Lab Equipment', label: 'Lab Equipment' },
  { value: 'Other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in-use', label: 'In Use' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'broken', label: 'Broken' },
  { value: 'retired', label: 'Retired' },
];

const EquipmentModal = ({ isOpen, onClose, onSave, equipment, rooms = [], faculty = [] }) => {
  const { notify } = useToasts();
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [type, setType] = useState('Projector');
  const [status, setStatus] = useState('available');
  const [location, setLocation] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [nextBookingStart, setNextBookingStart] = useState('');
  const [nextBookingEnd, setNextBookingEnd] = useState('');
  
  // Debug: log when props change
  useEffect(() => {
    if (isOpen) {
      console.log('[EquipmentModal] Modal opened with:', { 
        roomsCount: rooms?.length, 
        facultyCount: faculty?.length,
        equipmentHasAssignedTo: equipment?.assignedTo,
        currentAssignedToState: assignedTo
      });
    }
  }, [isOpen, rooms?.length, faculty?.length, equipment?.assignedTo, assignedTo]);

  useEffect(() => {
    if (equipment) {
      console.log('[EquipmentModal] Setting form from equipment:', equipment);
      setName(equipment.name || '');
      setType(equipment.type || 'Projector');
      setStatus(equipment.status || 'available');
      setLocation(equipment.location || '');
      setAssignedTo(equipment.assignedTo || '');
      console.log('[EquipmentModal] Set assignedTo to:', equipment.assignedTo || '');
      setNextBookingStart(equipment.nextBookingStart ? new Date(equipment.nextBookingStart).toISOString().slice(0, 16) : '');
      setNextBookingEnd(equipment.nextBookingEnd ? new Date(equipment.nextBookingEnd).toISOString().slice(0, 16) : '');
    } else {
      setName('');
      setType('Projector');
      setStatus('available');
      setLocation('');
      setAssignedTo('');
      setNextBookingStart('');
      setNextBookingEnd('');
    }
  }, [equipment, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!name.trim()) {
      notify('error', 'Equipment name is required');
      return;
    }
    
    if (!type) {
      notify('error', 'Equipment type is required');
      return;
    }
    
    setIsSaving(true);
    try {
      const formData = {
        name: name.trim(),
        type,
        status: status || 'available',
        location: location?.trim() || null,
        assignedTo: assignedTo?.trim() || null,
        nextBookingStart: nextBookingStart ? new Date(nextBookingStart).toISOString() : null,
        nextBookingEnd: nextBookingEnd ? new Date(nextBookingEnd).toISOString() : null
      };
      
      console.log('[EquipmentModal] Saving equipment with data:', formData);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save equipment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Create location options from rooms
  const locationOptions = rooms?.map(r => ({
    value: r.name,
    label: r.name
  })) || [];
  
  // Create faculty options
  const facultyOptions = faculty?.map(f => ({
    value: f.fullName || f.name || f.email,
    label: f.fullName || f.name || f.email
  })) || [];

  return (
    <ModalBase
      open={isOpen}
      onClose={onClose}
      title={equipment ? 'Edit Equipment' : 'Create Equipment'}
      subtitle={equipment ? 'Update equipment information' : 'Add new equipment to the system'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSaving} iconName="Save">
            {equipment ? 'Save Changes' : 'Create Equipment'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Equipment Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Projector Epson EB-U50"
            required
            autoFocus
          />
          
          <Select
            label="Equipment Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={EQUIPMENT_TYPES}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS}
            required
          />
          
        <div>
          <Select
            label="Location (Room)"
            value={location}
            onChange={(value) => setLocation(value || '')}
            options={[
              { value: '', label: 'Select room...' },
              ...locationOptions
            ]}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Select from existing rooms
          </p>
        </div>
      </div>

      <div>
        <Select
          label="Assigned To (Teacher)"
          value={assignedTo}
          onChange={(value) => {
            console.log('[EquipmentModal] assignedTo changed from', assignedTo, 'to', value);
            setAssignedTo(value || '');
          }}
          clearable
          options={[
            { value: '', label: facultyOptions.length === 0 ? 'Loading teachers...' : 'Not assigned...' },
            ...facultyOptions
          ]}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {facultyOptions.length === 0 
            ? 'No teachers available. Please check your connection.' 
            : 'Select teacher responsible for this equipment'}
        </p>
      </div>        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Booking Start"
            type="datetime-local"
            value={nextBookingStart}
            onChange={(e) => setNextBookingStart(e.target.value)}
          />
          
          <Input
            label="Booking End"
            type="datetime-local"
            value={nextBookingEnd}
            onChange={(e) => setNextBookingEnd(e.target.value)}
          />
        </div>

        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Equipment will be visible to all users. Make sure the information is accurate and up-to-date.
          </p>
        </div>
      </form>
    </ModalBase>
  );
};

export default EquipmentModal;
