// Mock implementation of DataLoader for tests
import React from 'react';

export default function DataLoader({ label = 'Loading data…', subtle = false }) {
  return (
    <div data-testid="data-loader" role="status" aria-live="polite">
      <div data-testid="loading-spinner">
        {label}
      </div>
    </div>
  );
}
