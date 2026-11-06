// src/pages/student-studies/components/TabsNav.jsx
import React from 'react';
import Button from '../../../components/ui/Button';

export default function TabsNav({ current, onGo }) {
    return (
        <div className="bg-card glass-card rounded-lg border border-border p-2 mb-6">
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={current === 'overview' ? 'default' : 'outline'} onClick={() => onGo('overview')}>Overview</Button>
                <Button size="sm" variant={current === 'courses' ? 'default' : 'outline'} onClick={() => onGo('courses')}>Courses</Button>
                <Button size="sm" variant={current === 'scholarships' ? 'default' : 'outline'} onClick={() => onGo('scholarships')}>Scholarships</Button>
                <Button size="sm" variant={current === 'financing' ? 'default' : 'outline'} onClick={() => onGo('financing')}>Financing</Button>
            </div>
        </div>
    );
}