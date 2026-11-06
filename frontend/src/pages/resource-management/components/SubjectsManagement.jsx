// src/pages/resource-management/components/SubjectsManagement.jsx
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
import { fetchCoursesForManagement, deleteCourse } from '../../../data/maisApiAdapter';
import { extractApiErrorMessage } from '../../../utils/apiErrors';
import CourseModal from './CourseModal';

const SubjectsManagement = () => {
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  const [subjects, setSubjects] = useState([]);
  const [facultiesData, setFacultiesData] = useState([]);
  const [programsData, setProgramsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  
  // Filters
  const [facultyFilter, setFacultyFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState('asc');

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const [coursesData, facultiesData, programsData] = await Promise.all([
        fetchCoursesForManagement({ ttl: 0 }),
        import('../../../data/facultyOptionsApi').then(m => m.fetchFacultyOptions()),
        import('../../../data/programsApi').then(m => m.fetchPrograms())
      ]);
      console.log('[SubjectsManagement] Loaded faculties:', facultiesData);
      console.log('[SubjectsManagement] Loaded programs:', programsData);
      setSubjects(coursesData);
      setFacultiesData(Array.isArray(facultiesData) ? facultiesData : []);
      setProgramsData(Array.isArray(programsData) ? programsData : []);
    } catch (error) {
      console.error('[SubjectsManagement] Error loading data:', error);
      notify('error', extractApiErrorMessage(error, 'Failed to load subjects'));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const filteredSubjects = useMemo(() => {
    let filtered = subjects.filter(subject => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        subject.code?.toLowerCase().includes(query) ||
        subject.nameEn?.toLowerCase().includes(query) ||
        subject.nameSk?.toLowerCase().includes(query) ||
        subject.faculty?.toLowerCase().includes(query);
      
      const matchesFaculty = !facultyFilter || subject.faculty === facultyFilter;
      const matchesProgram = !programFilter || subject.program === programFilter;
      const matchesType = !typeFilter || subject.typeSk === typeFilter;
      
      return matchesSearch && matchesFaculty && matchesProgram && matchesType;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'code':
          aVal = a.code || '';
          bVal = b.code || '';
          break;
        case 'name':
          aVal = a.nameEn || a.nameSk || '';
          bVal = b.nameEn || b.nameSk || '';
          break;
        case 'credits':
          aVal = a.credits || 0;
          bVal = b.credits || 0;
          break;
        case 'faculty':
          aVal = a.faculty || '';
          bVal = b.faculty || '';
          break;
        case 'program':
          aVal = a.program || '';
          bVal = b.program || '';
          break;
        case 'type':
          aVal = a.typeSk || '';
          bVal = b.typeSk || '';
          break;
        default:
          return 0;
      }
      
      if (sortBy === 'credits') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      } else {
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortOrder === 'asc' ? comparison : -comparison;
      }
    });
    
    return filtered;
  }, [subjects, searchQuery, facultyFilter, programFilter, typeFilter, sortBy, sortOrder]);
  
  // Get unique values for filters
  const faculties = useMemo(() => 
    Array.from(new Set(subjects.map(s => s.faculty).filter(Boolean))).sort(),
    [subjects]
  );
  
  const programs = useMemo(() => 
    Array.from(new Set(subjects.map(s => s.program).filter(Boolean))).sort(),
    [subjects]
  );
  
  const types = useMemo(() => 
    Array.from(new Set(subjects.map(s => s.typeSk).filter(Boolean))).sort(),
    [subjects]
  );

  const totalPages = Math.ceil(filteredSubjects.length / perPage);
  const paginatedSubjects = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredSubjects.slice(start, start + perPage);
  }, [filteredSubjects, page, perPage]);

  const handleCreate = () => {
    setEditingCourse(null);
    setIsModalOpen(true);
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setIsModalOpen(true);
  };

  const handleDelete = async (course) => {
    const courseName = course.nameEn || course.nameSk || course.code;
    if (!confirm(`Are you sure you want to delete "${courseName}"?\n\nThis action cannot be undone and may fail if the course is used in schedules or enrollments.`)) {
      return;
    }

    setDeleting(course.code);
    try {
      await deleteCourse(course.code);
      notify('success', `Course "${courseName}" deleted successfully`);
      await loadSubjects();
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to delete course'));
    } finally {
      setDeleting(null);
    }
  };

  const handleModalClose = async (saved) => {
    setIsModalOpen(false);
    setEditingCourse(null);
    if (saved) {
      await loadSubjects();
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  if (loading && subjects.length === 0) {
    return (
      <DataLoader 
        fullScreen 
        label="Loading Subjects…"
        description="Fetching course catalog from the system."
        details={[
          'Course codes and names',
          'Credits and course types',
          'Faculty and program associations'
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
            <h2 className="text-xl font-semibold text-foreground">Subjects & Courses</h2>
            <div className="text-sm text-muted-foreground">
              Total: {subjects.length}
              {filteredSubjects.length !== subjects.length && (
                <span className="text-primary"> • {filteredSubjects.length} filtered</span>
              )}
            </div>
          </div>
          
          <Button iconName="Plus" onClick={handleCreate}>
            Create Subject
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Subjects</div>
            <div className="text-2xl font-semibold text-foreground">{subjects.length}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Faculties</div>
            <div className="text-2xl font-semibold text-foreground">{faculties.length}</div>
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
            <div className="text-2xl font-semibold text-foreground">{filteredSubjects.length}</div>
          </motion.div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 md:gap-4">
          <div className="xl:col-span-5 min-w-0">
            <Input
              type="search"
              placeholder="Search by code, name, or faculty..."
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
                ...faculties.filter(f => f !== 'TUKE').map(f => ({ value: f, label: f }))
              ]}
              value={facultyFilter}
              onChange={(v) => {
                setFacultyFilter(v);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <Select
              placeholder="Program"
              options={[
                { value: '', label: 'All Programs' },
                ...programs.map(p => ({ value: p, label: p }))
              ]}
              value={programFilter}
              onChange={(v) => {
                setProgramFilter(v);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <Select
              placeholder="Type"
              options={[
                { value: '', label: 'All Types' },
                ...types.map(t => ({ value: t, label: t }))
              ]}
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Subjects table */}
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
                  onClick={() => handleSort('credits')}
                >
                  <div className="flex items-center gap-1">
                    Credits
                    {sortBy === 'credits' && (
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
                  onClick={() => handleSort('program')}
                >
                  <div className="flex items-center gap-1">
                    Program
                    {sortBy === 'program' && (
                      <Icon name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Profile</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Icon name="Search" size={48} className="text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No subjects found matching your search' : 'No subjects available'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedSubjects.map((subject) => (
                  <tr key={subject.code} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{subject.code}</td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {subject.nameEn || subject.nameSk || '-'}
                      {subject.nameEn && subject.nameSk && (
                        <div className="text-xs text-muted-foreground mt-0.5">{subject.nameSk}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {subject.typeSk ? (
                        <span className="px-2 py-1 bg-purple-500/10 text-purple-500 rounded text-xs font-medium">
                          {subject.typeSk}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{subject.credits || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{subject.faculty || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{subject.program || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      {subject.profile ? (
                        <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-xs font-medium">
                          {subject.profile}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          iconName="Pencil"
                          onClick={() => handleEdit(subject)}
                          disabled={deleting === subject.code}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          iconName={deleting === subject.code ? undefined : "Trash2"}
                          onClick={() => handleDelete(subject)}
                          disabled={deleting === subject.code}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          {deleting === subject.code && (
                            <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Reveal as={motion.div} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card rounded-xl border border-border p-3 sm:p-4" delay={ANIMATION_DELAYS.PAGINATION} variant="keycap" waitForLoaders={true}>
          <div className="order-2 lg:order-1 text-sm text-muted-foreground min-w-0">
            Showing {(page - 1) * perPage + 1} to {Math.min(filteredSubjects.length, page * perPage)} of {filteredSubjects.length} subjects
          </div>
          <div className="order-1 lg:order-2 w-full lg:w-auto flex flex-col gap-2 min-w-0">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onChange={setPage}
              className="justify-between lg:justify-end"
            />
            <div className="lg:hidden text-xs text-muted-foreground text-center">
              Page {page} / {totalPages}
            </div>
          </div>
        </Reveal>
      )}

      {/* Course Modal */}
      <CourseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        course={editingCourse}
        onSaved={() => handleModalClose(true)}
        faculties={facultiesData}
        programs={programsData}
      />
    </div>
  );
};

export default SubjectsManagement;
