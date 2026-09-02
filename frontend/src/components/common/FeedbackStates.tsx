import React from 'react';
import { AlertTriangle, RefreshCw, Inbox } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to Load Data',
  message = 'Unable to load robot fleet telemetry. Check that the RoboPulse API is running on port 5000.',
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div className="feedback-box error" role="alert">
      <div className="feedback-icon-container">
        <AlertTriangle size={20} />
      </div>
      <h3 className="feedback-title">{title}</h3>
      <p className="feedback-desc">{message}</p>
      {onRetry && (
        <button
          type="button"
          className="btn btn-default"
          onClick={onRetry}
          disabled={isRetrying}
          style={{ marginTop: '8px' }}
        >
          <RefreshCw size={14} className={isRetrying ? 'spin' : ''} />
          <span>{isRetrying ? 'Retrying...' : 'Retry Connection'}</span>
        </button>
      )}
    </div>
  );
};

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Data Available',
  message = 'There are currently no records available in this section.',
  actionText,
  onAction,
}) => {
  return (
    <div className="feedback-box">
      <div className="feedback-icon-container">
        <Inbox size={20} />
      </div>
      <h3 className="feedback-title">{title}</h3>
      <p className="feedback-desc">{message}</p>
      {actionText && onAction && (
        <button
          type="button"
          className="btn btn-default"
          onClick={onAction}
          style={{ marginTop: '8px' }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 6,
}) => {
  return (
    <div className="table-container" style={{ opacity: 0.8 }}>
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <div className="skeleton" style={{ height: '14px', width: '80px' }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={rIdx}>
              {Array.from({ length: cols }).map((_, cIdx) => (
                <td key={cIdx}>
                  <div
                    className="skeleton"
                    style={{
                      height: '16px',
                      width: cIdx === 0 ? '110px' : cIdx === 1 ? '140px' : '75px',
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const CardsSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card"
          style={{ padding: '16px 20px', minHeight: '94px' }}
        >
          <div className="skeleton" style={{ height: '12px', width: '70%', marginBottom: '10px' }} />
          <div className="skeleton" style={{ height: '28px', width: '45%' }} />
        </div>
      ))}
    </div>
  );
};
