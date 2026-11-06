// src/pages/student-dashboard/components/MyCoursesGrid.jsx
import React from 'react';
import CourseCard from './CourseCard';

export default function MyCoursesGrid({ courses }) {
    return (
        <section aria-labelledby="my-courses-title">
            <h2 id="my-courses-title" className="text-lg font-semibold text-foreground mb-4">My Courses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courses.map((c) => (
                    <CourseCard key={c.id} course={c} />
                ))}
            </div>
            {courses.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
                    No courses yet.
                </div>
            )}
        </section>
    );
}