// src/pages/class-schedule-management/components/ClassGroupManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Filter, Users, GraduationCap, Building2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { useToasts } from '../../../components/ui/Toasts';
import DataLoader from '../../../components/ui/DataLoader';
import Icon from '../../../components/AppIcon';
import ClassGroupModal from './ClassGroupModal';
import { fetchClassGroups, fetchDistinctFaculties, fetchDistinctPrograms, deleteClassGroup } from '../../../data/maisApiAdapter';
import { extractApiErrorMessage } from '../../../utils/apiErrors';

const ClassGroupManagement = ({ userEmail }) => {
  const { notify } = useToasts();
  const [groups, setGroups] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  // Filters
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsData, facultiesData, programsData] = await Promise.all([
        fetchClassGroups({ activeOnly: true }),
        fetchDistinctFaculties(),
        fetchDistinctPrograms()
      ]);
      setGroups(groupsData);
      setFaculties(facultiesData);
      setPrograms(programsData);
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to load class groups'));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = useCallback(() => {
    setEditingGroup(null);
    setIsModalOpen(true);
  }, []);

  const handleEdit = useCallback((group) => {
    setEditingGroup(group);
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback(async (group) => {
    if (!confirm(`Are you sure you want to delete "${group.name}"?\nThis action cannot be undone.`)) {
      return;
    }

    setDeleting(group.id);
    try {
      await deleteClassGroup(group.id);
      notify('success', `Class group "${group.name}" deleted successfully`);
      await loadData();
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to delete class group'));
    } finally {
      setDeleting(null);
    }
  }, [notify, loadData]);

  const handleModalClose = useCallback(async (saved) => {
    setIsModalOpen(false);
    setEditingGroup(null);
    if (saved) {
      await loadData();
    }
  }, [loadData]);

  // Filter options
  const facultyOptions = useMemo(() => [
    { value: 'all', label: 'All Faculties' },
    ...faculties.map(f => {
      const str = typeof f === 'object' && f !== null 
        ? (f.name || f.code || String(f)) 
        : String(f || '');
      return { value: str, label: str };
    })
  ], [faculties]);

  const programOptions = useMemo(() => [
    { value: 'all', label: 'All Programs' },
    ...programs.map(p => {
      const str = typeof p === 'object' && p !== null 
        ? (p.name || p.code || String(p)) 
        : String(p || '');
      return { value: str, label: str };
    })
  ], [programs]);

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      if (selectedFaculty !== 'all' && g.faculty !== selectedFaculty) return false;
      if (selectedProgram !== 'all' && g.program !== selectedProgram) return false;
      return true;
    });
  }, [groups, selectedFaculty, selectedProgram]);

  return (
    <div className="space-y-6">
      {loading && (
        <DataLoader
          label="Loading class groups…"
          description="Fetching class groups, faculties, and programs."
          details={[
            'Class group data • faculty information • program details',
            'Capacity and enrollment data • teacher assignments',
            'Active groups and filtering options',
          ]}
          fullScreen
        />
      )}

      {!loading && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Class Groups</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage class groups with faculty, program, and student capacity
          </p>
        </div>
        <Button
          onClick={handleCreate}
          iconName="Plus"
          className="shrink-0"
          disabled={loading && groups.length === 0}
        >
          Create Class Group
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Faculty"
            options={facultyOptions}
            value={selectedFaculty}
            onChange={setSelectedFaculty}
            searchable
          />
          <Select
            label="Program"
            options={programOptions}
            value={selectedProgram}
            onChange={setSelectedProgram}
            searchable
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">{filteredGroups.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-foreground text-lg font-medium">No class groups found</p>
              <p className="text-muted-foreground text-sm mt-1">
                {groups.length === 0 ? 'Create your first class group to get started' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Faculty
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Program
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Students
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <AnimatePresence mode="popLayout">
                    {filteredGroups.map((group) => (
                      <motion.tr
                        key={group.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-foreground font-medium">{group.name}</div>
                          {group.description && (
                            <div className="text-muted-foreground text-xs mt-0.5">{group.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                            {group.faculty}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-foreground">{group.program}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  group.studentCount >= group.capacity
                                    ? 'bg-destructive'
                                    : group.studentCount / group.capacity > 0.8
                                    ? 'bg-warning'
                                    : 'bg-success'
                                }`}
                                style={{ width: `${(group.studentCount / group.capacity) * 100}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
                              {group.studentCount} / {group.capacity}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(group)}
                              title="Edit class group"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(group)}
                              disabled={deleting === group.id || group.studentCount > 0}
                              loading={deleting === group.id}
                              title={group.studentCount > 0 ? 'Cannot delete group with enrolled students' : 'Delete class group'}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>

        </>
      )}

      {/* Modal */}
      {isModalOpen && (
        <ClassGroupModal
          isOpen={isModalOpen}
          group={editingGroup}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default ClassGroupManagement;
