// src/pages/resource-management/components/RoomModal.jsx
import React, { useState, useEffect } from 'react';
import ModalBase from '../../../components/ui/ModalBase';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import { useToasts } from '../../../components/ui/Toasts';

// Auto-generate room code from name
const generateRoomCode = (name, building) => {
  if (!name || !name.trim()) return '';
  
  // Extract room number/identifier from name
  // Examples: "N9-201(ZP1)" -> "N9-201", "Lab 305" -> "L305", "Classroom A" -> "CLA"
  const cleaned = name.trim();
  
  // If name already contains building-room pattern (e.g., "N9-201"), use it
  const buildingRoomPattern = /([A-Z0-9]+[-_]?[0-9]+)/i;
  const match = cleaned.match(buildingRoomPattern);
  if (match) {
    return match[1].toUpperCase();
  }
  
  // Otherwise, combine building prefix with extracted numbers or abbreviation
  const numbers = cleaned.match(/\d+/);
  if (numbers && building && building !== 'Other') {
    return `${building}-${numbers[0]}`.toUpperCase();
  }
  
  // Fall back to first 3-4 characters
  return cleaned.substring(0, 4).toUpperCase().replace(/\s+/g, '');
};

const ROOM_TYPES = [
  { value: 'Lecture Hall', label: 'Lecture Hall' },
  { value: 'Classroom', label: 'Classroom' },
  { value: 'Seminar', label: 'Seminar Room' },
  { value: 'Lab', label: 'Laboratory' },
  { value: 'Computer Lab', label: 'Computer Lab' },
  { value: 'Virtual Room', label: 'Virtual Room' },
  { value: 'Office', label: 'Office' },
  { value: 'Conference', label: 'Conference Room' },
  { value: 'Other', label: 'Other' },
];

const BUILDINGS = [
  { value: 'N9', label: 'N9 - Main Building' },
  { value: 'L9', label: 'L9 - Laboratory Building' },
  { value: 'PK6', label: 'PK6 - Park Komenského 6' },
  { value: 'BC', label: 'BC - Boženy Němcovej' },
  { value: 'Virtual', label: 'Virtual/Online' },
  { value: 'Other', label: 'Other' },
];

const RoomModal = ({ isOpen, onClose, onSave, room }) => {
  const { notify } = useToasts();
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('Classroom');
  const [capacity, setCapacity] = useState('');
  const [building, setBuilding] = useState('N9');
  const [floor, setFloor] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);

  useEffect(() => {
    if (room) {
      setName(room.name || '');
      setCode(room.code || '');
      setType(room.type || 'Classroom');
      setCapacity(room.capacity?.toString() || '');
      setBuilding(room.building || 'N9');
      setFloor(room.floor || '');
      setLocation(room.location || '');
      setLink(room.link || '');
      setEmail(room.email || '');
      setDescription(room.description || '');
      setActive(room.active ?? true);
      setAutoGenerateCode(false); // Disable auto-generation when editing
    } else {
      setName('');
      setCode('');
      setType('Classroom');
      setCapacity('');
      setBuilding('N9');
      setFloor('');
      setLocation('');
      setLink('');
      setEmail('');
      setDescription('');
      setActive(true);
      setAutoGenerateCode(true);
    }
  }, [room, isOpen]);

  // Auto-generate code when name or building changes (only for new rooms)
  useEffect(() => {
    if (!room && autoGenerateCode && name) {
      const generatedCode = generateRoomCode(name, building);
      setCode(generatedCode);
    }
  }, [name, building, room, autoGenerateCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!name.trim()) {
      notify('error', 'Room name is required');
      return;
    }
    
    if (!code.trim()) {
      notify('error', 'Room code is required');
      return;
    }
    
    if (!type) {
      notify('error', 'Room type is required');
      return;
    }
    
    const parsedCapacity = capacity ? parseInt(capacity) : null;
    if (capacity && (isNaN(parsedCapacity) || parsedCapacity < 1)) {
      notify('error', 'Capacity must be a positive number');
      return;
    }
    
    setIsSaving(true);
    try {
      const formData = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        capacity: parsedCapacity,
        building: building || null,
        floor: floor?.trim() || null,
        location: location?.trim() || null,
        link: link?.trim() || null,
        email: email?.trim() || null,
        description: description?.trim() || null,
        active
      };
      
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save room:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase
      open={isOpen}
      onClose={onClose}
      title={room ? 'Edit Room' : 'Create Room'}
      subtitle={room ? 'Update room information' : 'Add a new room to the system'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSaving} iconName="Save">
            {room ? 'Save Changes' : 'Create Room'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Room Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., N9-201(ZP1)"
            required
            autoFocus
            description="Full room name or identifier"
          />
          
          <Input
            label="Room Code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setAutoGenerateCode(false); // Disable auto-generation if manually edited
            }}
            placeholder="e.g., N9-201"
            required
            disabled={!!room}
            description={
              room 
                ? "Room code cannot be changed" 
                : autoGenerateCode 
                  ? "Auto-generated from name and building (edit to customize)" 
                  : "Unique identifier (will be auto-uppercased)"
            }
          />
        </div>
        
        {!room && autoGenerateCode && code && (
          <p className="text-xs text-primary -mt-3">
            ✓ Auto-generating code from room name and building
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Room Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={ROOM_TYPES}
            required
          />
          
          <Input
            label="Capacity"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g., 30"
            min="1"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Building"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            options={BUILDINGS}
          />
          
          <Input
            label="Floor"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="e.g., 2nd floor"
          />
        </div>

        <Input
          label="Location Details"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g., East wing, near elevators"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Link/URL"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="e.g., https://maps.tuke.sk/room/n9-201"
          />
          
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g., room.n9-201@university.edu"
          />
        </div>

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional information about the room..."
          rows={3}
        />

        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <input
            type="checkbox"
            id="room-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
          />
          <label htmlFor="room-active" className="text-sm font-medium text-foreground cursor-pointer select-none">
            Active Room
          </label>
        </div>
      </form>
    </ModalBase>
  );
};

export default RoomModal;
