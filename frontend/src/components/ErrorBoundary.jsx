// src/components/ErrorBoundary.jsx
import React from "react";
import Icon from "./AppIcon";
import { createLogger } from '../utils/logger';
const logger = createLogger('ErrorBoundary');

if (typeof window !== "undefined") {
  const key = "__COMPONENT_ERROR__";
  if (typeof window[key] !== "function") {
    window[key] = (error, errorInfo) => {
      try {
        const evt = new CustomEvent("app:component-error", {
          detail: { error, errorInfo }
        });
        window.dispatchEvent(evt);
      } catch {}
      logger.error("[ErrorBoundary] component error:", error, errorInfo);
    };
  }
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      lastError: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, lastError: error };
  }

  componentDidCatch(error, errorInfo) {
    try {
      const reporter =
          (typeof window !== "undefined" &&
              typeof window["__COMPONENT_ERROR__"] === "function" &&
              window["__COMPONENT_ERROR__"]) ||
          null;
      if (reporter) reporter(error, errorInfo);
    } catch {}

    try {
      const { onError } = this.props || {};
      if (typeof onError === "function") {
        onError(error, errorInfo);
      }
    } catch {}

    if (typeof document !== "undefined") {
      document.documentElement.classList.add("has-app-error");
    }
    if (typeof window !== "undefined") {
      window.__APP_HAS_ERROR = true;
    }

    this.setState({ errorInfo });
  }

  componentWillUnmount() {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("has-app-error");
    }
    if (typeof window !== "undefined") {
      window.__APP_HAS_ERROR = false;
      window.dispatchEvent(new Event("app:clear-error"));
    }
  }

  render() {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback != null) return fallback;

      return (
          <div className="relative min-h-screen overflow-hidden">
            <div className="bg-stage" aria-hidden>
              <div className="clouds-bg" />
              <div className="bg-image" />
              <div className="vignette" />
            </div>

            <div className="aurora a1" aria-hidden />
            <div className="aurora a2" aria-hidden />

            <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
              <div className="text-center p-8 max-w-md backdrop-blur-md/0">
                <div className="flex justify-center items-center mb-2">
                  <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="42"
                      height="42"
                      viewBox="0 0 32 33"
                      fill="none"
                      aria-hidden="true"
                  >
                    <path
                        d="M16 28.5C22.6274 28.5 28 23.1274 28 16.5C28 9.87258 22.6274 4.5 16 4.5C9.37258 4.5 4 9.87258 4 16.5C4 23.1274 9.37258 28.5 16 28.5Z"
                        stroke="#DCEAF7"
                        strokeWidth="2"
                        strokeMiterlimit="10"
                    />
                    <path
                        d="M11.5 15.5C12.3284 15.5 13 14.8284 13 14C13 13.1716 12.3284 12.5 11.5 12.5C10.6716 12.5 10 13.1716 10 14C10 14.8284 10.6716 15.5 11.5 15.5Z"
                        fill="#DCEAF7"
                    />
                    <path
                        d="M20.5 15.5C21.3284 15.5 22 14.8284 22 14C22 13.1716 21.3284 12.5 20.5 12.5C19.6716 12.5 19 13.1716 19 14C19 14.8284 19.6716 15.5 20.5 15.5Z"
                        fill="#DCEAF7"
                    />
                    <path
                        d="M21 22.5C19.9625 20.7062 18.2213 19.5 16 19.5C13.7787 19.5 12.0375 20.7062 11 22.5"
                        stroke="#DCEAF7"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="flex flex-col gap-1 text-center">
                  <h1 className="text-2xl font-medium text-[#DCEAF7]">
                    Something went wrong
                  </h1>
                  <p className="text-[#DCEAF7]/80 text-base w w-8/12 mx-auto">
                    We encountered an unexpected error while processing your request.
                  </p>
                </div>

                <div className="flex justify-center items-center mt-6">
                  <button
                      type="button"
                      onClick={() => {
                        try {
                          window.dispatchEvent(new Event("app:clear-error"));
                        } catch {}
                        window.location.href = "/";
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded flex items-center gap-2 transition-colors duration-200 shadow-sm"
                  >
                    <Icon name="ArrowLeft" size={18} color="#fff" />
                    Back
                  </button>
                </div>
              </div>
            </div>
          </div>
      );
    }

    return children || null;
  }
}

export default ErrorBoundary;