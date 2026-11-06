// src/pages/resource-management/components/DepartmentsManagement.jsx
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
import DepartmentModal from './DepartmentModal';
import { fetchDepartments, createDepartment, updateDepartment, deleteDepartment } from '../../../data/departmentsApi';
import { fetchFacultyOptions } from '../../../data/facultyOptionsApi';

const DepartmentsManagement = () => {
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  const [departments, setDepartments] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  
  // Filters
  const [facultyFilter, setFacultyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const [departmentsData, facultiesData] = await Promise.all([
        fetchDepartments(),
        fetchFacultyOptions()
      ]);
      setDepartments(departmentsData);
      setFaculties(facultiesData);
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to load departments'));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const filteredDepartments = useMemo(() => {
    let filtered = departments.filter(dept => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        dept.name?.toLowerCase().includes(query) ||
        dept.code?.toLowerCase().includes(query) ||
        dept.faculty?.toLowerCase().includes(query);
      
      const matchesFaculty = !facultyFilter || dept.faculty === facultyFilter;
      const matchesStatus = !statusFilter || 
        (statusFilter === 'active' ? dept.active : !dept.active);
      
      return matchesSearch && matchesFaculty && matchesStatus;
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
        case 'teachersCount':
          aVal = a.teachersCount || 0;
          bVal = b.teachersCount || 0;
          break;
        case 'active':
          aVal = a.active ? 1 : 0;
          bVal = b.active ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (sortBy === 'teachersCount' || sortBy === 'active') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [departments, searchQuery, facultyFilter, statusFilter, sortBy, sortOrder]);

  const paginatedDepartments = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredDepartments.slice(start, start + perPage);
  }, [filteredDepartments, page]);

  const totalPages = Math.ceil(filteredDepartments.length / perPage);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleAdd = () => {
    setEditingDepartment(null);
    setIsModalOpen(true);
  };

  const handleEdit = (dept) => {
    setEditingDepartment(dept);
    setIsModalOpen(true);
  };

  const handleDelete = async (dept) => {
    if (!window.confirm(`Are you sure you want to delete "${dept.name}"?`)) return;
    
    setDeleting(dept.id);
    try {
      await deleteDepartment(dept.id);
      setDepartments(prev => prev.filter(d => d.id !== dept.id));
      notify('success', 'Department deleted successfully');
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to delete department'));
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async (departmentData) => {
    try {
      if (editingDepartment) {
        const updated = await updateDepartment(editingDepartment.id, departmentData);
        setDepartments(prev => prev.map(d => 
          d.id === editingDepartment.id ? updated : d
        ));
        notify('success', 'Department updated successfully');
      } else {
        const newDept = await createDepartment(departmentData);
        setDepartments(prev => [...prev, newDept]);
        notify('success', 'Department created successfully');
      }
      setIsModalOpen(false);
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to save department'));
      throw error;
    }
  };

  if (loading) {
    return (
      <DataLoader 
        fullScreen 
        label="Loading Departments…"
        description="Fetching department data from the system."
        details={[
          'Department names and codes',
          'Faculty associations and hierarchies',
          'Teacher assignments and statistics'
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
            <h2 className="text-xl font-semibold text-foreground">Departments</h2>
            <div className="text-sm text-muted-foreground">
              Total: {departments.length}
              {filteredDepartments.length !== departments.length && (
                <span className="text-primary"> • {filteredDepartments.length} filtered</span>
              )}
            </div>
          </div>
          
          <Button iconName="Plus" onClick={handleAdd}>
            Create Department
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Departments</div>
            <div className="text-2xl font-semibold text-foreground">{departments.length}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Active Departments</div>
            <div className="text-2xl font-semibold text-foreground">
              {departments.filter(d => d.active).length}
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Teachers</div>
            <div className="text-2xl font-semibold text-foreground">
              {departments.reduce((sum, d) => sum + (d.teachersCount || 0), 0)}
            </div>
          </motion.div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 md:gap-4">
          <div className="xl:col-span-6 min-w-0">
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

          <div className="xl:col-span-3 min-w-0">
            <Select
              placeholder="Faculty"
              options={[
                { value: '', label: 'All Faculties' },
                { value: 'FEI', label: 'FEI' },
                { value: 'FBERG', label: 'FBERG' },
                { value: 'SjF', label: 'SjF' }
              ]}
              value={facultyFilter}
              onChange={(v) => {
                setFacultyFilter(v);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-3 min-w-0">
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

      {/* Departments table */}
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
                    Name
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
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort('teachersCount')}
                >
                  <div className="flex items-center gap-1">
                    Teachers
                    {sortBy === 'teachersCount' && (
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
              {paginatedDepartments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="Building" size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">No departments found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDepartments.map((dept, index) => (
                  <Reveal key={dept.id} as="tr" className="hover:bg-muted/20 transition-colors" variant="keycap" waitForLoaders={true} delay={ANIMATION_DELAYS.STEP * index}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-500/10 text-purple-500 text-xs font-medium">
                        {dept.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{dept.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">
                        {dept.faculty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{dept.teachersCount || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      {dept.active ? (
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
                          onClick={() => handleEdit(dept)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          iconName="Trash2"
                          onClick={() => handleDelete(dept)}
                          disabled={deleting === dept.id}
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
        <DepartmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          department={editingDepartment}
          faculties={faculties}
        />
      )}
    </div>
  );
};

export default DepartmentsManagement;
