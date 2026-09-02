import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { Robot } from '../types/robot';
import type { ProductionLine } from '../types/productionLine';
import { RobotTable } from '../components/dashboard/RobotTable';
import { TableSkeleton, ErrorState } from '../components/common/FeedbackStates';

interface RobotsPageProps {
  robots: Robot[];
  productionLines: ProductionLine[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectRobot: (robot: Robot) => void;
}

export const RobotsPage: React.FC<RobotsPageProps> = ({
  robots,
  productionLines,
  loading,
  error,
  onRetry,
  onSelectRobot,
}) => {
  const navigate = useNavigate();

  if (error && robots.length === 0) {
    return (
      <ErrorState
        title="Fleet Registry Unavailable"
        message={error}
        onRetry={onRetry}
        isRetrying={loading}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Robotic Fleet Registry ({robots.length} Units)
          </h2>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}
          >
            Complete industrial robot inventory, status tracking, and runtime telemetry
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/predictions')}
          style={{ height: '36px', padding: '0 14px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Sparkles size={15} />
          <span>Predictive Maintenance & Risk Intelligence</span>
        </button>
      </div>

      {loading && robots.length === 0 ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <RobotTable
          robots={robots}
          productionLines={productionLines}
          onSelectRobot={onSelectRobot}
          showFilters={true}
        />
      )}
    </div>
  );
};
