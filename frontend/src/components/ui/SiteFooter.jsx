// src/components/ui/SiteFooter.jsx
import React, { useEffect, useState } from "react";
import { cn } from "../../utils/cn";

const defaultWrapperClass =
    "w-full border-t border-white/10 bg-white/10 backdrop-blur-md";
const defaultInnerClass =
    "mx-auto max-w-6xl px-4 py-4 text-center text-[12px] text-white/70";

const SiteFooter = ({ className, innerClassName, prefix = "MAIS 2.0 · TUKE" }) => {
    const [clock, setClock] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <footer className={cn(defaultWrapperClass, className)}>
            <div className={cn(defaultInnerClass, innerClassName)}>
                © {new Date().getFullYear()} {prefix} · {clock.toLocaleString()}
            </div>
        </footer>
    );
};

export default SiteFooter;

