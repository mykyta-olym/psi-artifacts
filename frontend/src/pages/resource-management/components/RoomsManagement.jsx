// src/pages/resource-management/components/RoomsManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Pagination from '../../../components/ui/Pagination';
import Reveal from '../../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../../constants/animations';
import useGlobalLoaderBlocking from '../../../hooks/useGlobalLoaderBlocking';
import { useToasts } from '../../../components/ui/Toasts';
import DataLoader from '../../../components/ui/DataLoader';
import Icon from '../../../components/AppIcon';
import { extractApiErrorMessage } from '../../../utils/apiErrors';
import RoomModal from './RoomModal';
import { fetchRooms, createRoom, updateRoom, deleteRoom } from '../../../data/roomsApi';
import useDataUpdates from '../../../hooks/useDataUpdates';

const RoomsManagement = ({ onRoomsChange }) => {
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const [justSaved, setJustSaved] = useState(false);
  const perPage = 20;
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const loadData = useCallback(async () => {
    console.log('[RoomsManagement] loadData called');
    setLoading(true);
    try {
      const roomsData = await fetchRooms();
      console.log('[RoomsManagement] Fetched rooms:', roomsData);
      console.log('[RoomsManagement] Rooms count:', roomsData?.length);
      console.log('[RoomsManagement] Rooms type:', Array.isArray(roomsData) ? 'array' : typeof roomsData);
      setRooms(roomsData);
    } catch (error) {
      console.error('[RoomsManagement] Failed to load rooms:', error);
      notify('error', extractApiErrorMessage(error, 'Failed to load rooms'));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Listen for room updates via SignalR
  const handleDataUpdate = useCallback((payload) => {
    if (payload?.type === 'room.updated') {
      console.log('[RoomsManagement] Room updated via SignalR, payload:', payload);
      console.log('[RoomsManagement] Current state - isModalOpen:', isModalOpen, 'justSaved:', justSaved);
      
      // Don't reload if modal is open - prevents state loss
      if (isModalOpen) {
        console.log('[RoomsManagement] Modal is open, skipping reload to preserve state');
        return;
      }
      
      // Don't reload immediately after saving - we already have the updated data
      if (justSaved) {
        console.log('[RoomsManagement] Just saved, skipping reload to prevent overwrite');
        return;
      }
      
      console.log('[RoomsManagement] Reloading rooms list...');
      loadData();
    }
  }, [loadData, isModalOpen, justSaved]);
  
  useDataUpdates(handleDataUpdate);

  const filteredRooms = useMemo(() => {
    let filtered = rooms.filter(room => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        room.name?.toLowerCase().includes(query) ||
        room.type?.toLowerCase().includes(query) ||
        room.building?.toLowerCase().includes(query) ||
        room.location?.toLowerCase().includes(query);
      
      const matchesType = !typeFilter || room.type === typeFilter;
      const matchesBuilding = !buildingFilter || room.building === buildingFilter;
      const matchesStatus = !statusFilter || 
        (statusFilter === 'active' ? room.active : !room.active);
      
      const roomCapacity = parseInt(room.capacity) || 0;
      const matchesMinCapacity = !minCapacity || roomCapacity >= parseInt(minCapacity);
      const matchesMaxCapacity = !maxCapacity || roomCapacity <= parseInt(maxCapacity);
      
      return matchesSearch && matchesType && matchesBuilding && matchesStatus && matchesMinCapacity && matchesMaxCapacity;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'type':
          aVal = a.type || '';
          bVal = b.type || '';
          break;
        case 'building':
          aVal = a.building || '';
          bVal = b.building || '';
          break;
        case 'capacity':
          aVal = parseInt(a.capacity) || 0;
          bVal = parseInt(b.capacity) || 0;
          break;
        case 'active':
          aVal = a.active ? 1 : 0;
          bVal = b.active ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (sortBy === 'active' || sortBy === 'capacity') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [rooms, searchQuery, typeFilter, buildingFilter, statusFilter, minCapacity, maxCapacity, sortBy, sortOrder]);

  const paginatedRooms = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredRooms.slice(start, start + perPage);
  }, [filteredRooms, page]);

  const totalPages = Math.ceil(filteredRooms.length / perPage);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleAdd = () => {
    setEditingRoom(null);
    setIsModalOpen(true);
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setIsModalOpen(true);
  };

  const handleDelete = async (room) => {
    if (!window.confirm(`Are you sure you want to delete room "${room.name}"?`)) return;
    
    setDeleting(room.id);
    try {
      await deleteRoom(room.id);
      setRooms(prev => prev.filter(r => r.id !== room.id));
      notify('success', 'Room deleted successfully');
      onRoomsChange?.();
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to delete room'));
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async (roomData) => {
    try {
      console.log('[RoomsManagement] handleSave called with:', roomData);
      if (editingRoom) {
        console.log('[RoomsManagement] Updating room:', editingRoom.id);
        console.log('[RoomsManagement] Setting justSaved=true BEFORE API call');
        
        // Mark that we're saving to prevent SignalR from overwriting while request is in flight
        setJustSaved(true);
        
        const updated = await updateRoom(editingRoom.id, roomData);
        console.log('[RoomsManagement] Update response:', updated);
        
        // Keep justSaved=true for 2 more seconds after response
        setTimeout(() => {
          console.log('[RoomsManagement] Resetting justSaved=false');
          setJustSaved(false);
        }, 2000);
        
        setRooms(prev => prev.map(r => 
          r.id === editingRoom.id ? updated : r
        ));
        notify('success', 'Room updated successfully');
      } else {
        console.log('[RoomsManagement] Creating new room');
        console.log('[RoomsManagement] Setting justSaved=true BEFORE API call');
        
        // Mark that we're saving to prevent SignalR from overwriting
        setJustSaved(true);
        
        const newRoom = await createRoom(roomData);
        console.log('[RoomsManagement] Create response:', newRoom);
        
        // Keep justSaved=true for 2 more seconds after response
        setTimeout(() => {
          console.log('[RoomsManagement] Resetting justSaved=false');
          setJustSaved(false);
        }, 2000);
        
        setRooms(prev => [...prev, newRoom]);
        notify('success', 'Room created successfully');
      }
      setIsModalOpen(false);
      onRoomsChange?.();
    } catch (error) {
      console.error('[RoomsManagement] Save failed:', error);
      notify('error', extractApiErrorMessage(error, 'Failed to save room'));
      throw error;
    }
  };

  // Get unique values for filters
  const uniqueTypes = useMemo(() => 
    [...new Set(rooms.map(r => r.type).filter(Boolean))].sort(),
    [rooms]
  );

  const uniqueBuildings = useMemo(() => 
    [...new Set(rooms.map(r => r.building).filter(Boolean))].sort(),
    [rooms]
  );

  if (loading) {
    return (
      <DataLoader 
        fullScreen 
        label="Loading Rooms…"
        description="Fetching room data."
        details={[
          'Room names and types',
          'Capacity and location info',
          'Building assignments'
        ]}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Rooms</h2>
            <div className="text-sm text-muted-foreground">
              Total: {rooms.length}
              {filteredRooms.length !== rooms.length && (
                <span className="text-primary"> • {filteredRooms.length} filtered</span>
              )}
            </div>
          </div>
          
          <Button iconName="Plus" onClick={handleAdd}>
            Create Room
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Rooms</div>
            <div className="text-2xl font-semibold text-foreground">{rooms.length}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Active Rooms</div>
            <div className="text-2xl font-semibold text-foreground">
              {rooms.filter(r => r.active).length}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP * 2, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Capacity</div>
            <div className="text-2xl font-semibold text-foreground">
              {rooms.reduce((sum, r) => sum + (parseInt(r.capacity) || 0), 0)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP * 3, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Filtered Results</div>
            <div className="text-2xl font-semibold text-foreground">
              {filteredRooms.length}
            </div>
          </motion.div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 md:gap-4">
          <div className="xl:col-span-3 min-w-0">
            <Input
              type="search"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <Select
              placeholder="Type"
              options={[
                { value: '', label: 'All Types' },
                ...uniqueTypes.map(t => ({ value: t, label: t }))
              ]}
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <Select
              placeholder="Building"
              options={[
                { value: '', label: 'All Buildings' },
                ...uniqueBuildings.map(b => ({ value: b, label: b }))
              ]}
              value={buildingFilter}
              onChange={(v) => {
                setBuildingFilter(v);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <Input
              type="number"
              placeholder="Min capacity"
              value={minCapacity}
              onChange={(e) => {
                setMinCapacity(e.target.value);
                setPage(1);
              }}
              min="1"
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <Input
              type="number"
              placeholder="Max capacity"
              value={maxCapacity}
              onChange={(e) => {
                setMaxCapacity(e.target.value);
                setPage(1);
              }}
              min="1"
            />
          </div>

          <div className="xl:col-span-1 min-w-0">
            <Select
              placeholder="Status"
              options={[
                { value: '', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Rooms table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Room Name
                    {sortBy === 'name' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-1">
                    Type
                    {sortBy === 'type' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('capacity')}
                >
                  <div className="flex items-center gap-1">
                    Capacity
                    {sortBy === 'capacity' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('building')}
                >
                  <div className="flex items-center gap-1">
                    Building
                    {sortBy === 'building' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Floor
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('active')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortBy === 'active' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedRooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="Building2" size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">No rooms found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRooms.map((room, index) => (
                  <Reveal key={room.id} as="tr" className="hover:bg-muted/20 transition-colors" variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.STEP * index}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{room.name}</span>
                        {room.location && (
                          <span className="text-xs text-muted-foreground">{room.location}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">
                        {room.type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">
                        {room.capacity ? `${room.capacity} seats` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-xs font-medium">
                        {room.building || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{room.floor || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {room.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-xs font-medium">
                          <Icon name="CheckCircle2" size={12} />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                          <Icon name="XCircle" size={12} />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconName="Pencil"
                          onClick={() => handleEdit(room)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          iconName="Trash2"
                          onClick={() => handleDelete(room)}
                          disabled={deleting === room.id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        />
                      </div>
                    </td>
                  </Reveal>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* Modal */}
      {isModalOpen && (
        <RoomModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          room={editingRoom}
        />
      )}
    </div>
  );
};

export default RoomsManagement;
