import React from 'react';
import { ChevronRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan';
  linkText?: string;
  onClick?: () => void;
  showSparkline?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  variant = 'blue',
  linkText,
  onClick,
  showSparkline = false,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'green':
        return {
          iconBg: '#f0fdf4',
          iconColor: '#16a34a',
          iconBorder: '#bbf7d0',
          sparkColor: '#16a34a',
          textColor: '#15803d',
        };
      case 'amber':
        return {
          iconBg: '#fffbeb',
          iconColor: '#d97706',
          iconBorder: '#fde68a',
          sparkColor: '#d97706',
          textColor: '#b45309',
        };
      case 'red':
        return {
          iconBg: '#fef2f2',
          iconColor: '#dc2626',
          iconBorder: '#fecaca',
          sparkColor: '#dc2626',
          textColor: '#b91c1c',
        };
      case 'purple':
        return {
          iconBg: '#faf5ff',
          iconColor: '#9333ea',
          iconBorder: '#e9d5ff',
          sparkColor: '#9333ea',
          textColor: '#7e22ce',
        };
      case 'cyan':
        return {
          iconBg: '#ecfeff',
          iconColor: '#0891b2',
          iconBorder: '#a5f3fc',
          sparkColor: '#0891b2',
          textColor: '#0e7490',
        };
      case 'blue':
      default:
        return {
          iconBg: '#eff6ff',
          iconColor: '#2563eb',
          iconBorder: '#bfdbfe',
          sparkColor: '#2563eb',
          textColor: '#1d4ed8',
        };
    }
  };

  const v = getVariantStyles();

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-md)',
        minHeight: '136px',
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          e.currentTarget.style.borderColor = 'var(--border-strong)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }
      }}
    >
      {/* Top Header: Icon container on left, label on right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: v.iconBg,
            border: `1px solid ${v.iconBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: v.iconColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              lineHeight: 1.2,
            }}
          >
            {label}
          </div>
          <div
            className="tabular-nums font-mono"
            style={{
              fontSize: '26px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.1,
              marginTop: '3px',
              letterSpacing: '-0.02em',
            }}
          >
            {value}
          </div>
        </div>
      </div>

      {/* Bottom Footer: Subtitle / percentage + Mini Sparkline OR Link action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px solid #f8fafc',
          fontSize: '11.5px',
        }}
      >
        {subtitle && (
          <span style={{ color: v.textColor, fontWeight: 600 }}>
            {subtitle}
          </span>
        )}

        {showSparkline && (
          <svg width="56" height="16" viewBox="0 0 56 16" fill="none">
            <path
              d="M1 11L10 6L19 12L28 4L37 9L46 3L55 8"
              stroke={v.sparkColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {linkText && (
          <span
            style={{
              color: 'var(--accent-primary)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <span>{linkText}</span>
            <ChevronRight size={13} />
          </span>
        )}
      </div>
    </div>
  );
};
