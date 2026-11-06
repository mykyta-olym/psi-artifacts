import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tagger from "@dhiwise/component-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProd = mode === "production";

  return {
    base: "/",
    plugins: [
      tsconfigPaths(),
      react(),
      tagger()
    ],
    server: {
      host: "0.0.0.0",
      port: 4028,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          ws: false,
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              // Suppress connection errors during API restart/reseed
              if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET') {
                return;
              }
              console.error('[vite] http proxy error:', req.url, err);
            });
          }
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            proxy.on('error', () => {
              // Suppress all proxy errors for uploads
            });
          }
        },
        '/swagger': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            proxy.on('error', () => {
              // Suppress all proxy errors for swagger
            });
          }
        },
        '/hubs': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              // Suppress connection errors during API restart/reseed
              if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET') {
                return;
              }
              console.error('[vite] websocket proxy error:', req.url, err);
            });
          }
        }
      }
    },
    preview: {
      host: "0.0.0.0",
      port: 4028
    },
    build: {
      outDir: "build",
      assetsDir: "assets",
      sourcemap: !isProd,
      cssTarget: "chrome90",
      target: "es2020",
      chunkSizeWarningLimit: 2000, // Increased for large icon library
      rollupOptions: {
        onwarn(warning, warn) {
          // Suppress PURE comment warnings from SignalR
          if (warning.code === 'SOURCEMAP_ERROR' || 
              (warning.code === 'PLUGIN_WARNING' && warning.message.includes('PURE'))) {
            return;
          }
          warn(warning);
        },
        output: {
          manualChunks(id) {
            // Core React libraries
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react';
            }
            // Router
            if (id.includes('node_modules/react-router')) {
              return 'router';
            }
            // SignalR
            if (id.includes('node_modules/@microsoft/signalr')) {
              return 'signalr';
            }
            // Framer Motion (large animation library)
            if (id.includes('node_modules/framer-motion')) {
              return 'motion';
            }
            // UI icons - split into smaller chunks
            if (id.includes('node_modules/lucide-react')) {
              return 'icons';
            }
            // Chart/visualization libraries - split by library
            if (id.includes('node_modules/recharts')) {
              return 'charts-recharts';
            }
            if (id.includes('node_modules/d3-')) {
              return 'charts-d3';
            }
            // Split ALL major page components into separate chunks
            if (id.includes('src/pages/')) {
              const pageName = id.split('src/pages/')[1]?.split('/')[0];
              if (pageName && [
                'teacher-dashboard', 
                'student-dashboard', 
                'class-schedule-management', 
                'grade-management', 
                'faculty-management', 
                'student-management',
                'resource-management',
                'zapis',
                'terminy',
                'activities',
                'attendance-tracking',
                'profile',
                'chat'
              ].includes(pageName)) {
                return `page-${pageName}`;
              }
            }
            // Split UI components
            if (id.includes('src/components/ui/')) {
              return 'ui-components';
            }
            // All other node_modules
            if (id.includes('node_modules/')) {
              return 'vendor';
            }
          }
        }
      }
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"]
    },
    envPrefix: "VITE_",
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "0.0.0")
    }
  };
});