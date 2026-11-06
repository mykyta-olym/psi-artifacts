// src/pages/resource-management/components/FacultiesManagement.jsx
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
import FacultyOptionModal from './FacultyOptionModal';
import { fetchFacultyOptions, createFacultyOption, updateFacultyOption, deleteFacultyOption } from '../../../data/facultyOptionsApi';

const FacultiesManagement = () => {
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState('asc');

  const loadFaculties = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFacultyOptions();
      setFaculties(data);
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to load faculties'));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadFaculties();
  }, [loadFaculties]);

  const filteredFaculties = useMemo(() => {
    let filtered = faculties.filter(faculty => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        faculty.code?.toLowerCase().includes(query) ||
        faculty.nameEn?.toLowerCase().includes(query) ||
        faculty.nameSk?.toLowerCase().includes(query);
      
      const matchesStatus = !statusFilter || 
        (statusFilter === 'active' ? faculty.active : !faculty.active);
      
      return matchesSearch && matchesStatus;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'code':
          aVal = a.code || '';
          bVal = b.code || '';
          break;
        case 'nameEn':
          aVal = a.nameEn || '';
          bVal = b.nameEn || '';
          break;
        case 'active':
          aVal = a.active ? 1 : 0;
          bVal = b.active ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (sortBy === 'active') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [faculties, searchQuery, statusFilter, sortBy, sortOrder]);

  const paginatedFaculties = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredFaculties.slice(start, start + perPage);
  }, [filteredFaculties, page, perPage]);

  const totalPages = Math.ceil(filteredFaculties.length / perPage);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleAdd = () => {
    setEditingFaculty(null);
    setIsModalOpen(true);
  };

  const handleEdit = (faculty) => {
    setEditingFaculty(faculty);
    setIsModalOpen(true);
  };

  const handleDelete = async (faculty) => {
    if (!window.confirm(`Are you sure you want to delete "${faculty.code}"?`)) return;
    
    setDeleting(faculty.id);
    try {
      await deleteFacultyOption(faculty.id);
      setFaculties(prev => prev.filter(f => f.id !== faculty.id));
      notify('success', 'Faculty deleted successfully');
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to delete faculty'));
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async (facultyData) => {
    try {
      if (editingFaculty) {
        const updated = await updateFacultyOption(editingFaculty.id, facultyData);
        setFaculties(prev => prev.map(f => 
          f.id === editingFaculty.id ? updated : f
        ));
        notify('success', 'Faculty updated successfully');
      } else {
        const newFaculty = await createFacultyOption(facultyData);
        setFaculties(prev => [...prev, newFaculty]);
        notify('success', 'Faculty created successfully');
      }
      setIsModalOpen(false);
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to save faculty'));
      throw error;
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <Icon name="ChevronsUpDown" size={14} className="text-muted-foreground/40" />;
    return sortOrder === 'asc' 
      ? <Icon name="ChevronUp" size={14} className="text-primary" />
      : <Icon name="ChevronDown" size={14} className="text-primary" />;
  };

  if (loading) {
    return (
      <DataLoader 
        fullScreen 
        label="Loading Faculty Options…"
        description="Fetching organizational unit data."
        details={[
          'Faculty codes and names (EN/SK)',
          'Organizational descriptions',
          'Active status and metadata'
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
            <h2 className="text-xl font-semibold text-foreground">Faculty Options</h2>
            <div className="text-sm text-muted-foreground">
              Total: {faculties.length}
              {filteredFaculties.length !== faculties.length && (
                <span className="text-primary"> • {filteredFaculties.length} filtered</span>
              )}
            </div>
          </div>
          
          <Button iconName="Plus" onClick={handleAdd}>
            Create Faculty
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Faculties</div>
            <div className="text-2xl font-semibold text-foreground">{faculties.length}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Active Faculties</div>
            <div className="text-2xl font-semibold text-foreground">
              {faculties.filter(f => f.active).length}
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Filtered Results</div>
            <div className="text-2xl font-semibold text-foreground">{filteredFaculties.length}</div>
          </motion.div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 md:gap-4">
          <div className="xl:col-span-8 min-w-0">
            <Input
              type="search"
              placeholder="Search by code or name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-4 min-w-0">
            <Select
              placeholder="Status"
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'active', label: 'Active Only' },
                { value: 'inactive', label: 'Inactive Only' }
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

      {/* Faculties table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1">
                    Code
                    {sortBy === 'code' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('nameEn')}
                >
                  <div className="flex items-center gap-1">
                    Name (EN)
                    {sortBy === 'nameEn' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Name (SK)
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
              {paginatedFaculties.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="Building2" size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">No faculties found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedFaculties.map((faculty, index) => (
                  <Reveal key={faculty.id} as="tr" className="hover:bg-muted/20 transition-colors" variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.STEP * index}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">
                        {faculty.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{faculty.nameEn}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{faculty.nameSk || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {faculty.active ? (
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
                          onClick={() => handleEdit(faculty)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          iconName="Trash2"
                          onClick={() => handleDelete(faculty)}
                          disabled={deleting === faculty.id}
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
        <FacultyOptionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          faculty={editingFaculty}
        />
      )}
    </div>
  );
};

export default FacultiesManagement;
