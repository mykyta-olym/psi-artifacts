// src/components/ui/LoaderBeamCanvas.jsx
import React, { useEffect, useMemo, useRef } from "react";
import createREGL from "regl";
import { createLogger } from '../../utils/logger';
const logger = createLogger('LoaderBeamCanvas');

export default function LoaderBeamCanvas({ active = true, span = 0.2, afterglow = 0, className = "" }) {
    const wrapRef = useRef(null);
    const reglRef = useRef(null);
    const drawRef = useRef(null);
    const rafRef = useRef(0);
    const startTimeRef = useRef(0);
    const sizeRef = useRef({ w: 1, h: 1, dpr: 1 });
    const lastSpanRef = useRef(span);
    const lastAfterglowRef = useRef(afterglow);
    const activeRef = useRef(active);

    useEffect(() => { lastSpanRef.current = span; }, [span]);
    useEffect(() => { lastAfterglowRef.current = afterglow; }, [afterglow]);
    useEffect(() => { activeRef.current = active; }, [active]);

    const vertex = useMemo(() => `
    precision mediump float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `, []);

    // Використовуємо похідні замість uResolution → нема "Unused property uResolution"
    const fragment = useMemo(() => `
    #ifdef GL_OES_standard_derivatives
    #extension GL_OES_standard_derivatives : enable
    #endif
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uActive;
    uniform float uSpan;
    uniform float uAfterglow;

    float sdLineY(vec2 uv, float t){
      float d = abs(uv.y - 0.5);
      return smoothstep(t, 0.0, d);
    }

    float bandMaskLeft(vec2 uv, float span, float pxX){
      float s = clamp(span, 0.0, 1.0);
      float edge = max(2.0 * pxX, 0.001);
      return 1.0 - smoothstep(s, s + edge, uv.x);
    }

    float glowTailRight(vec2 uv, float edge, float tailPx, float pxX){
      float tail = max(tailPx * pxX, 0.0);
      return 1.0 - smoothstep(edge, edge + tail, uv.x);
    }

    void main() {
      // Піксель у UV через похідні
      float pxX = max(fwidth(vUv.x), 1e-6);
      float pxY = max(fwidth(vUv.y), 1e-6);
      float activeMask = step(0.5, uActive);

      vec2 uv = vUv;

      float core  = sdLineY(uv, 1.5 * pxY);
      float glow1 = sdLineY(uv, 8.0  * pxY);
      float glow2 = sdLineY(uv, 18.0 * pxY);

      float flicker = 0.85 + 0.15 * sin(uTime * 6.0) + 0.05 * sin(uTime * 21.0);

      float grad = smoothstep(0.0, 1.0, uv.x);
      vec3 colA = vec3(0.74, 0.87, 1.00);
      vec3 colB = vec3(0.65, 0.82, 0.98);
      vec3 colC = vec3(0.78, 0.69, 0.98);
      vec3 beam = mix(mix(colA, colB, grad), colC, 0.35);

      float band = bandMaskLeft(uv, uSpan, pxX);
      float tail = glowTailRight(uv, uSpan, 60.0, pxX) * clamp(uAfterglow, 0.0, 1.0);
      float maskGlow = clamp(band + tail, 0.0, 1.0);

      vec3 color =
        beam * glow2 * 0.35 * flicker * maskGlow +
        beam * glow1 * 0.65 * flicker * maskGlow +
        vec3(1.0) * core * band;

      float alpha =
        (glow2 * 0.35 + glow1 * 0.6) * maskGlow +
        core * band;

      gl_FragColor = vec4(color * activeMask, clamp(alpha * activeMask, 0.0, 1.0));
    }
  `, []);

    const startLoop = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        const tick = () => {
            const r = reglRef.current;
            const d = drawRef.current;
            if (!r || !d) return;
            
            try {
                // Check if WebGL context is lost (try to access gl context safely)
                let gl = null;
                try {
                    gl = r._gl || (r._regl && r._regl._gl) || null;
                } catch {}
                
                if (gl && typeof gl.isContextLost === 'function' && gl.isContextLost()) {
                    // Context is lost, stop the loop
                    rafRef.current = 0;
                    return;
                }
                
                const t = (performance.now() - startTimeRef.current) / 1000;
                const { w, h } = sizeRef.current;

                r.clear({ color: [0, 0, 0, 0], depth: 1, stencil: 0 });
                d({
                    uTime: t,
                    uActive: activeRef.current ? 1 : 0,
                    uSpan: lastSpanRef.current,
                    uAfterglow: lastAfterglowRef.current,
                    viewport: { x: 0, y: 0, width: w, height: h }
                });

                rafRef.current = requestAnimationFrame(tick);
            } catch (err) {
                // Handle WebGL context lost errors gracefully
                const errMsg = err?.message || String(err || '');
                if (errMsg.includes('context lost') || errMsg.includes('CONTEXT_LOST')) {
                    // Context is lost, stop the loop silently
                    rafRef.current = 0;
                    return;
                }
                // Log other errors but don't crash
                logger.warn('[LoaderBeamCanvas] Error in render loop:', err);
                rafRef.current = 0;
            }
        };
        rafRef.current = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        const r = reglRef.current;
        if (r) r.clear({ color: [0, 0, 0, 0], depth: 1, stencil: 0 });
    };

    useEffect(() => {
        if (!wrapRef.current || reglRef.current) return;

        const canvas = document.createElement("canvas");
        canvas.style.position = "absolute";
        canvas.style.inset = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.pointerEvents = "none";
        const rootEl = wrapRef.current;
        rootEl.appendChild(canvas);

        const regl = createREGL({
            canvas,
            attributes: { antialias: false, alpha: true, depth: false, stencil: false, preserveDrawingBuffer: false },
            extensions: ["oes_standard_derivatives"]
        });

        const buffer = regl.buffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
        const draw = regl({
            vert: vertex,
            frag: fragment,
            attributes: { aPosition: buffer },
            count: 3,
            uniforms: {
                uTime: (_, props) => props.uTime,
                uActive: (_, props) => props.uActive,
                uSpan:   (_, props) => props.uSpan,
                uAfterglow: (_, props) => props.uAfterglow,
            },
            viewport: (_, props) => props.viewport,
            blend: { enable: true }
        });

        const handleSize = () => {
            const rect = rootEl.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            const wCss = Math.max(1, Math.floor(rect.width));
            const hCss = Math.max(1, Math.floor(rect.height));
            sizeRef.current = {
                w: Math.max(1, Math.floor(wCss * dpr)),
                h: Math.max(1, Math.floor(hCss * dpr)),
                dpr
            };
            canvas.width = sizeRef.current.w;
            canvas.height = sizeRef.current.h;
            canvas.style.width = `${wCss}px`;
            canvas.style.height = `${hCss}px`;
        };

        let ro = null;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(handleSize);
            ro.observe(rootEl);
        } else {
            window.addEventListener("resize", handleSize, { passive: true });
        }
        handleSize();

        const onLost = (e) => {
            e.preventDefault();
            // Stop the animation loop when context is lost
            stopLoop();
        };
        const onRestored = () => {
            // Restart the loop when context is restored
            if (activeRef.current && reglRef.current && drawRef.current) {
                startTimeRef.current = performance.now();
                startLoop();
            }
        };
        canvas.addEventListener("webglcontextlost", onLost, false);
        canvas.addEventListener("webglcontextrestored", onRestored, false);

        reglRef.current = regl;
        drawRef.current = draw;
        startTimeRef.current = performance.now();

        if (activeRef.current) startLoop();

        return () => {
            stopLoop();
            if (ro) ro.disconnect();
            else window.removeEventListener("resize", handleSize);
            canvas.removeEventListener("webglcontextlost", onLost);
            canvas.removeEventListener("webglcontextrestored", onRestored);
            try { regl.destroy(); } catch {}
            reglRef.current = null;
            drawRef.current = null;
            if (rootEl && canvas.parentNode === rootEl) rootEl.removeChild(canvas);
        };
    }, [vertex, fragment]);

    useEffect(() => {
        if (!reglRef.current || !drawRef.current) return;
        if (active) startLoop();
        else stopLoop();
    }, [active]);

    return <div ref={wrapRef} className={`absolute inset-0 pointer-events-none ${className}`} />;
}