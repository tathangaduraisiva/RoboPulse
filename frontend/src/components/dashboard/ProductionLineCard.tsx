import React from 'react';
import { MapPin, Bot, ChevronRight } from 'lucide-react';
import type { ProductionLine } from '../../types/productionLine';
import { RobotAvatar } from '../common/RobotAvatar';

interface ProductionLineCardProps {
  line: ProductionLine;
  onClick?: () => void;
  isSelected?: boolean;
}

export const ProductionLineCard: React.FC<ProductionLineCardProps> = ({
  line,
  onClick,
  isSelected = false,
}) => {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        border: isSelected
          ? '1px solid var(--accent-primary)'
          : '1px solid var(--border-subtle)',
        backgroundColor: isSelected ? 'var(--accent-surface)' : 'var(--bg-surface)',
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
      }}
      onMouseEnter={(e) => {
        if (onClick && !isSelected) {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick && !isSelected) {
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
          e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
        }
      }}
    >
      <div>
        {/* Header with Title and Code */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--accent-surface)',
                border: '1px solid var(--accent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                flexShrink: 0,
              }}
            >
              <RobotAvatar productionLine={line} size={32} showGlow />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {line.name}
              </h3>
            </div>
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            {line.code}
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginBottom: '14px',
            lineHeight: 1.4,
          }}
        >
          {line.description}
        </p>
      </div>

      {/* Footer Info: Location & Robot Count */}
      <div
        style={{
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: 'var(--text-muted)',
          }}
        >
          <MapPin size={13} />
          <span>{line.location}</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          <Bot size={14} style={{ color: 'var(--accent-primary)' }} />
          <span className="tabular-nums">
            {line.robot_count} {line.robot_count === 1 ? 'robot' : 'robots'}
          </span>
          {onClick && (
            <ChevronRight
              size={14}
              style={{ color: 'var(--text-muted)', marginLeft: '2px' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
