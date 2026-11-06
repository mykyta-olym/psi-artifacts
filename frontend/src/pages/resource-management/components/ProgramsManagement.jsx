// src/pages/resource-management/components/ProgramsManagement.jsx
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
import ProgramModal from './ProgramModal';
import { fetchPrograms, createProgram, updateProgram, deleteProgram } from '../../../data/programsApi';
import { fetchFacultyOptions } from '../../../data/facultyOptionsApi';
import { fetchDepartments } from '../../../data/departmentsApi';

const ProgramsManagement = () => {
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  const [programs, setPrograms] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  
  // Filters
  const [facultyFilter, setFacultyFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [programsData, facultiesData, departmentsData] = await Promise.all([
        fetchPrograms(),
        fetchFacultyOptions(),
        fetchDepartments()
      ]);
      setPrograms(programsData);
      setFaculties(facultiesData);
      setDepartments(departmentsData);
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to load programs'));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPrograms = useMemo(() => {
    let filtered = programs.filter(prog => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        prog.name?.toLowerCase().includes(query) ||
        prog.code?.toLowerCase().includes(query) ||
        prog.faculty?.toLowerCase().includes(query);
      
      const matchesFaculty = !facultyFilter || prog.faculty === facultyFilter;
      const matchesDepartment = !departmentFilter || prog.departmentId === departmentFilter;
      const matchesLevel = !levelFilter || prog.level === levelFilter;
      const matchesStatus = !statusFilter || 
        (statusFilter === 'active' ? prog.active : !prog.active);
      
      return matchesSearch && matchesFaculty && matchesDepartment && matchesLevel && matchesStatus;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'code':
          aVal = a.code || '';
          bVal = b.code || '';
          break;
        case 'faculty':
          aVal = a.faculty || '';
          bVal = b.faculty || '';
          break;
        case 'level':
          aVal = a.level || '';
          bVal = b.level || '';
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
  }, [programs, searchQuery, facultyFilter, departmentFilter, levelFilter, statusFilter, sortBy, sortOrder]);

  const paginatedPrograms = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredPrograms.slice(start, start + perPage);
  }, [filteredPrograms, page]);

  const totalPages = Math.ceil(filteredPrograms.length / perPage);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleAdd = () => {
    setEditingProgram(null);
    setIsModalOpen(true);
  };

  const handleEdit = (prog) => {
    setEditingProgram(prog);
    setIsModalOpen(true);
  };

  const handleDelete = async (prog) => {
    if (!window.confirm(`Are you sure you want to delete "${prog.name}"?`)) return;
    
    setDeleting(prog.id);
    try {
      await deleteProgram(prog.id);
      setPrograms(prev => prev.filter(p => p.id !== prog.id));
      notify('success', 'Program deleted successfully');
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to delete program'));
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async (programData) => {
    try {
      if (editingProgram) {
        const updated = await updateProgram(editingProgram.id, programData);
        setPrograms(prev => prev.map(p => 
          p.id === editingProgram.id ? updated : p
        ));
        notify('success', 'Program updated successfully');
      } else {
        const newProg = await createProgram(programData);
        setPrograms(prev => [...prev, newProg]);
        notify('success', 'Program created successfully');
      }
      setIsModalOpen(false);
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to save program'));
      throw error;
    }
  };

  // Get available departments for filter based on selected faculty
  const filteredDepartmentsForFilter = useMemo(() => {
    if (!facultyFilter) return departments;
    return departments.filter(d => d.faculty === facultyFilter);
  }, [departments, facultyFilter]);

  if (loading) {
    return (
      <DataLoader 
        fullScreen 
        label="Loading Study Programs…"
        description="Fetching academic program data."
        details={[
          'Program names and codes',
          'Faculty and department associations',
          'Degree levels and descriptions'
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
            <h2 className="text-xl font-semibold text-foreground">Study Programs</h2>
            <div className="text-sm text-muted-foreground">
              Total: {programs.length}
              {filteredPrograms.length !== programs.length && (
                <span className="text-primary"> • {filteredPrograms.length} filtered</span>
              )}
            </div>
          </div>
          
          <Button iconName="Plus" onClick={handleAdd}>
            Create Program
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Programs</div>
            <div className="text-2xl font-semibold text-foreground">{programs.length}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Active Programs</div>
            <div className="text-2xl font-semibold text-foreground">
              {programs.filter(p => p.active).length}
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
            <div className="text-2xl font-semibold text-foreground">
              {filteredPrograms.length}
            </div>
          </motion.div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 md:gap-4">
          <div className="xl:col-span-4 min-w-0">
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

          <div className="xl:col-span-2 min-w-0">
            <Select
              placeholder="Faculty"
              options={[
                { value: '', label: 'All Faculties' },
                ...faculties.map(f => ({ value: f.code, label: f.code }))
              ]}
              value={facultyFilter}
              onChange={(v) => {
                setFacultyFilter(v);
                setDepartmentFilter(''); // Reset department when faculty changes
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <Select
              placeholder="Department"
              options={[
                { value: '', label: 'All Departments' },
                ...filteredDepartmentsForFilter.map(d => ({ value: d.id, label: d.name }))
              ]}
              value={departmentFilter}
              onChange={(v) => {
                setDepartmentFilter(v);
                setPage(1);
              }}
              disabled={!facultyFilter}
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <Select
              placeholder="Level"
              options={[
                { value: '', label: 'All Levels' },
                { value: 'Bachelor', label: 'Bachelor' },
                { value: 'Master', label: 'Master' },
                { value: 'PhD', label: 'PhD' }
              ]}
              value={levelFilter}
              onChange={(v) => {
                setLevelFilter(v);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
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

      {/* Programs table */}
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
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Program Name
                    {sortBy === 'name' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('faculty')}
                >
                  <div className="flex items-center gap-1">
                    Faculty
                    {sortBy === 'faculty' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Department
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('level')}
                >
                  <div className="flex items-center gap-1">
                    Level
                    {sortBy === 'level' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
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
              {paginatedPrograms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="GraduationCap" size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">No programs found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPrograms.map((prog, index) => (
                  <Reveal key={prog.id} as="tr" className="hover:bg-muted/20 transition-colors" variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.STEP * index}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-xs font-medium">
                        {prog.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{prog.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">
                        {prog.faculty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {departments.find(d => d.id === prog.departmentId)?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-500">
                        Master
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {prog.active ? (
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
                          onClick={() => handleEdit(prog)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          iconName="Trash2"
                          onClick={() => handleDelete(prog)}
                          disabled={deleting === prog.id}
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
        <ProgramModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          program={editingProgram}
          faculties={faculties}
          departments={departments}
        />
      )}
    </div>
  );
};

export default ProgramsManagement;
