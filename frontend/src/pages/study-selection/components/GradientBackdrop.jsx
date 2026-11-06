// src/pages/study-selection/components/GradientBackdrop.jsx
import React from "react";

const GradientBackdrop = () => {
    return (
        <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-x-0 -top-1/3 h-2/3 bg-gradient-to-b from-sky-500/14 via-transparent to-transparent blur-2xl" />
            <div className="absolute inset-x-0 -bottom-1/3 h-2/3 bg-gradient-to-t from-indigo-500/16 via-transparent to-transparent blur-2xl" />
            <div className="absolute inset-0 [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:22px_22px]" />
        </div>
    );
};

export default GradientBackdrop;