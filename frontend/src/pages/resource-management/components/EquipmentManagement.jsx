// src/pages/resource-management/components/EquipmentManagement.jsx
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
import EquipmentModal from './EquipmentModal';
import { fetchEquipment, createEquipment, updateEquipment, deleteEquipment } from '../../../data/equipmentApi';
import useDataUpdates from '../../../hooks/useDataUpdates';

const EquipmentManagement = ({ rooms = [], faculty = [] }) => {
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const [localFaculty, setLocalFaculty] = useState(faculty);
  const [justSaved, setJustSaved] = useState(false);
  const perPage = 20;
  
  // Load faculty when component mounts if not provided
  useEffect(() => {
    const loadFacultyIfNeeded = async () => {
      if (!faculty || faculty.length === 0) {
        try {
          const { fetchFaculty } = await import('../../../data/maisApiAdapter');
          const facultyData = await fetchFaculty({ pageSize: 500, sort: 'fullName', order: 'asc' });
          console.log('[EquipmentManagement] Loaded faculty locally:', facultyData?.length);
          setLocalFaculty(Array.isArray(facultyData) ? facultyData : []);
        } catch (error) {
          console.error('[EquipmentManagement] Failed to load faculty:', error);
          setLocalFaculty([]);
        }
      } else {
        console.log('[EquipmentManagement] Using faculty from props:', faculty?.length);
        setLocalFaculty(faculty);
      }
    };
    loadFacultyIfNeeded();
  }, [faculty]);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const loadData = useCallback(async () => {
    console.log('[EquipmentManagement] loadData called');
    setLoading(true);
    try {
      const equipmentData = await fetchEquipment();
      console.log('[EquipmentManagement] Fetched equipment:', equipmentData);
      console.log('[EquipmentManagement] Equipment count:', equipmentData?.length);
      console.log('[EquipmentManagement] Equipment type:', Array.isArray(equipmentData) ? 'array' : typeof equipmentData);
      setEquipment(equipmentData);
    } catch (error) {
      console.error('[EquipmentManagement] Failed to load equipment:', error);
      notify('error', extractApiErrorMessage(error, 'Failed to load equipment'));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Listen for equipment updates via SignalR
  const handleDataUpdate = useCallback((payload) => {
    if (payload?.type === 'equipment.updated') {
      console.log('[EquipmentManagement] Equipment updated via SignalR, payload:', payload);
      console.log('[EquipmentManagement] Current state - isModalOpen:', isModalOpen, 'justSaved:', justSaved);
      
      // Don't reload immediately after saving - we already have the updated data
      // This check must come FIRST because modal might close before SignalR arrives
      if (justSaved) {
        console.log('[EquipmentManagement] ✅ Just saved, skipping reload to prevent overwrite');
        return;
      }
      
      // Don't reload if modal is open - prevents faculty dropdown from disappearing
      if (isModalOpen) {
        console.log('[EquipmentManagement] ✅ Modal is open, skipping reload to preserve state');
        return;
      }
      
      console.log('[EquipmentManagement] ⚠️ RELOADING equipment list from server...');
      loadData();
    }
  }, [loadData, isModalOpen, justSaved]);
  
  useDataUpdates(handleDataUpdate);

  const filteredEquipment = useMemo(() => {
    let filtered = equipment.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        item.name?.toLowerCase().includes(query) ||
        item.type?.toLowerCase().includes(query) ||
        item.location?.toLowerCase().includes(query) ||
        item.assignedTo?.toLowerCase().includes(query);
      
      const matchesType = !typeFilter || item.type === typeFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;
      const matchesLocation = !locationFilter || item.location === locationFilter;
      
      return matchesSearch && matchesType && matchesStatus && matchesLocation;
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
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'location':
          aVal = a.location || '';
          bVal = b.location || '';
          break;
        default:
          return 0;
      }
      
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [equipment, searchQuery, typeFilter, statusFilter, locationFilter, sortBy, sortOrder]);

  const paginatedEquipment = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredEquipment.slice(start, start + perPage);
  }, [filteredEquipment, page]);

  const totalPages = Math.ceil(filteredEquipment.length / perPage);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleAdd = () => {
    setEditingEquipment(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingEquipment(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete equipment "${item.name}"?`)) return;
    
    setDeleting(item.id);
    try {
      await deleteEquipment(item.id);
      setEquipment(prev => prev.filter(e => e.id !== item.id));
      notify('success', 'Equipment deleted successfully');
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to delete equipment'));
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async (equipmentData) => {
    try {
      console.log('[EquipmentManagement] handleSave called with:', equipmentData);
      if (editingEquipment) {
        console.log('[EquipmentManagement] Updating equipment:', editingEquipment.id);
        console.log('[EquipmentManagement] Setting justSaved=true BEFORE API call');
        
        // Mark that we're saving to prevent SignalR from overwriting while request is in flight
        setJustSaved(true);
        
        const updated = await updateEquipment(editingEquipment.id, equipmentData);
        console.log('[EquipmentManagement] Update response:', updated);
        console.log('[EquipmentManagement] Updated equipment assignedTo:', updated.assignedTo);
        
        // Keep justSaved=true for 2 more seconds after response
        setTimeout(() => {
          console.log('[EquipmentManagement] Resetting justSaved=false');
          setJustSaved(false);
        }, 2000);
        
        console.log('[EquipmentManagement] Current equipment state BEFORE update:', equipment.find(e => e.id === editingEquipment.id));
        setEquipment(prev => {
          const newState = prev.map(e => 
            e.id === editingEquipment.id ? updated : e
          );
          console.log('[EquipmentManagement] Updated equipment in state:', newState.find(e => e.id === editingEquipment.id));
          return newState;
        });
        notify('success', 'Equipment updated successfully');
      } else {
        console.log('[EquipmentManagement] Creating new equipment');
        console.log('[EquipmentManagement] Setting justSaved=true BEFORE API call');
        
        // Mark that we're saving to prevent SignalR from overwriting
        setJustSaved(true);
        
        const newEquipment = await createEquipment(equipmentData);
        console.log('[EquipmentManagement] Create response:', newEquipment);
        
        // Keep justSaved=true for 2 more seconds after response
        setTimeout(() => {
          console.log('[EquipmentManagement] Resetting justSaved=false');
          setJustSaved(false);
        }, 2000);
        
        setEquipment(prev => [...prev, newEquipment]);
        notify('success', 'Equipment created successfully');
      }
      console.log('[EquipmentManagement] Closing modal...');
      setIsModalOpen(false);
    } catch (error) {
      console.error('[EquipmentManagement] Save failed:', error);
      notify('error', extractApiErrorMessage(error, 'Failed to save equipment'));
      throw error;
    }
  };

  // Get unique values for filters
  const uniqueTypes = useMemo(() => 
    [...new Set(equipment.map(e => e.type).filter(Boolean))].sort(),
    [equipment]
  );

  const uniqueLocations = useMemo(() => 
    [...new Set(equipment.map(e => e.location).filter(Boolean))].sort(),
    [equipment]
  );

  // Get status badge styling
  const getStatusBadge = (status) => {
    const statusConfig = {
      'available': { color: 'green', icon: 'CheckCircle2' },
      'in-use': { color: 'blue', icon: 'Clock' },
      'maintenance': { color: 'yellow', icon: 'Wrench' },
      'broken': { color: 'red', icon: 'AlertCircle' }
    };

    const config = statusConfig[status] || { color: 'gray', icon: 'Circle' };
    const colorClasses = {
      green: 'bg-green-500/10 text-green-500',
      blue: 'bg-blue-500/10 text-blue-500',
      yellow: 'bg-yellow-500/10 text-yellow-500',
      red: 'bg-red-500/10 text-red-500',
      gray: 'bg-muted text-muted-foreground'
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${colorClasses[config.color]} text-xs font-medium`}>
        <Icon name={config.icon} size={12} />
        {status ? status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ') : '—'}
      </span>
    );
  };

  if (loading) {
    return (
      <DataLoader 
        fullScreen 
        label="Loading Equipment…"
        description="Fetching equipment data."
        details={[
          'Equipment names and types',
          'Status and location info',
          'Assignment details'
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
            <h2 className="text-xl font-semibold text-foreground">Equipment</h2>
            <div className="text-sm text-muted-foreground">
              Total: {equipment.length}
              {filteredEquipment.length !== equipment.length && (
                <span className="text-primary"> • {filteredEquipment.length} filtered</span>
              )}
            </div>
          </div>
          
          <Button iconName="Plus" onClick={handleAdd}>
            Add Equipment
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Equipment</div>
            <div className="text-2xl font-semibold text-foreground">{equipment.length}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Available</div>
            <div className="text-2xl font-semibold text-foreground">
              {equipment.filter(e => e.status === 'available' && !e.assignedTo).length}
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">In Use</div>
            <div className="text-2xl font-semibold text-foreground">
              {equipment.filter(e => e.status === 'in-use' || (e.status === 'available' && e.assignedTo)).length}
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
              {filteredEquipment.length}
            </div>
          </motion.div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 md:gap-4">
          <div className="xl:col-span-4 min-w-0">
            <Input
              type="search"
              placeholder="Search equipment..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-3 min-w-0">
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
              placeholder="Status"
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'available', label: 'Available' },
                { value: 'in-use', label: 'In Use' },
                { value: 'maintenance', label: 'Maintenance' },
                { value: 'broken', label: 'Broken' }
              ]}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-3 min-w-0">
            <Select
              placeholder="Location"
              options={[
                { value: '', label: 'All Locations' },
                ...uniqueLocations.map(l => ({ value: l, label: l }))
              ]}
              value={locationFilter}
              onChange={(v) => {
                setLocationFilter(v);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Equipment table */}
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
                    Equipment Name
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
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortBy === 'status' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('location')}
                >
                  <div className="flex items-center gap-1">
                    Location
                    {sortBy === 'location' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Assigned To
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Next Booking
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedEquipment.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="Package" size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">No equipment found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedEquipment.map((item, index) => (
                  <Reveal key={item.id} as="tr" className="hover:bg-muted/20 transition-colors" variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.STEP * index}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">
                        {item.type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{item.location || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{item.assignedTo || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {item.nextBookingStart && item.nextBookingEnd 
                          ? `${new Date(item.nextBookingStart).toLocaleString('en-GB', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })} - ${new Date(item.nextBookingEnd).toLocaleTimeString('en-GB', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconName="Pencil"
                          onClick={() => handleEdit(item)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          iconName="Trash2"
                          onClick={() => handleDelete(item)}
                          disabled={deleting === item.id}
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
        <EquipmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          equipment={editingEquipment}
          rooms={rooms}
          faculty={localFaculty}
        />
      )}
    </div>
  );
};

export default EquipmentManagement;
