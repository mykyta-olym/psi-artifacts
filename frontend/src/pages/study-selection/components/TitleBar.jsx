// src/pages/study-selection/components/TitleBar.jsx
import React from "react";
import Icon from "components/AppIcon";

const TitleBar = () => {
    return (
        <div className="mb-5 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <div className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shrink-0">
                <Icon name="GraduationCap" size={18} color="#fff" />
            </div>
            <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold leading-tight truncate">Study Selection</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Pick which study to open and work with.</p>
            </div>
        </div>
    );
};

export default TitleBar;