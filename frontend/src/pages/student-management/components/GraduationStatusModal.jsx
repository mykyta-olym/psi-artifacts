// src/pages/student-management/components/GraduationStatusModal.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const GraduationStatusModal = ({ student, isOpen, onClose }) => {
  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Graduation Status</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Not Implemented Message */}
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
              <Icon name="AlertCircle" className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Feature Not Implemented</h3>
            <p className="text-sm text-muted-foreground italic mb-6">
              Graduation status management is currently not available.
            </p>
            <div className="bg-muted/30 rounded-lg p-4 text-left">
              <div className="text-sm text-muted-foreground mb-1">Student</div>
              <div className="font-medium text-foreground">{student.fullName}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {student.program} • Year {student.studyYear}
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraduationStatusModal;
