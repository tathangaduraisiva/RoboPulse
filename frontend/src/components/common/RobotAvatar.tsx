import React from 'react';
import type { Robot } from '../../types/robot';
import type { ProductionLine } from '../../types/productionLine';

export type RobotEyeColorTheme = 'red' | 'yellow' | 'green' | 'blue' | 'cyan';

export interface RobotColorConfig {
  primary: string;
  glow: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  label: string;
}

export const ROBOT_LINE_COLORS: Record<RobotEyeColorTheme, RobotColorConfig> = {
  red: {
    primary: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.45)',
    badgeBg: '#fef2f2',
    badgeBorder: '#fecaca',
    badgeText: '#b91c1c',
    label: 'Assembly Line A (Red)',
  },
  yellow: {
    primary: '#eab308',
    glow: 'rgba(234, 179, 8, 0.45)',
    badgeBg: '#fefce8',
    badgeBorder: '#fef08a',
    badgeText: '#854d0e',
    label: 'Packaging Line D (Yellow)',
  },
  green: {
    primary: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.45)',
    badgeBg: '#f0fdf4',
    badgeBorder: '#bbf7d0',
    badgeText: '#15803d',
    label: 'Painting Line C (Green)',
  },
  blue: {
    primary: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.45)',
    badgeBg: '#eff6ff',
    badgeBorder: '#bfdbfe',
    badgeText: '#1d4ed8',
    label: 'Welding Line B (Blue)',
  },
  cyan: {
    primary: '#5ce1e6',
    glow: 'rgba(92, 225, 230, 0.45)',
    badgeBg: '#ecfeff',
    badgeBorder: '#a5f3fc',
    badgeText: '#0e7490',
    label: 'Standard Telemetry (Cyan)',
  },
};

/**
 * Resolves the appropriate eye and mouth color theme based on line information.
 * - Assembly Line A (ASM-A) -> Red
 * - Packaging Line D (PKG-D) -> Yellow
 * - Painting Line C (PNT-C) -> Green
 * - Welding Line B (WLD-B) -> Blue
 */
export function getRobotLineTheme(
  lineIdentifier?: string | null,
  lineCode?: string | null,
  lineName?: string | null
): RobotEyeColorTheme {
  const combined = `${lineIdentifier || ''} ${lineCode || ''} ${lineName || ''}`.toLowerCase();

  // 1. Assembly Line A -> Red
  if (
    combined.includes('asm-a') ||
    combined.includes('assembly') ||
    combined.includes('line a') ||
    lineIdentifier === '10000000-0000-0000-0000-000000000001'
  ) {
    return 'red';
  }

  // 2. Packaging Line D -> Yellow
  if (
    combined.includes('pkg-d') ||
    combined.includes('packaging') ||
    combined.includes('line d') ||
    lineIdentifier === '10000000-0000-0000-0000-000000000004'
  ) {
    return 'yellow';
  }

  // 3. Painting Line C -> Green
  if (
    combined.includes('pnt-c') ||
    combined.includes('painting') ||
    combined.includes('line c') ||
    lineIdentifier === '10000000-0000-0000-0000-000000000003'
  ) {
    return 'green';
  }

  // 4. Welding Line B -> Blue
  if (
    combined.includes('wld-b') ||
    combined.includes('welding') ||
    combined.includes('line b') ||
    lineIdentifier === '10000000-0000-0000-0000-000000000002'
  ) {
    return 'blue';
  }

  // Explicit color checks
  if (combined.includes('red')) return 'red';
  if (combined.includes('yellow')) return 'yellow';
  if (combined.includes('green')) return 'green';
  if (combined.includes('blue')) return 'blue';

  return 'blue'; // default to blue if welding/general
}

export function getRobotThemeForRobot(
  robot?: Robot | null,
  productionLines: ProductionLine[] = []
): RobotEyeColorTheme {
  if (!robot) return 'blue';
  const matchedLine = robot.line_id
    ? productionLines.find((l) => l.id === robot.line_id)
    : null;

  return getRobotLineTheme(
    robot.line_id,
    matchedLine?.code || robot.serial_number,
    matchedLine?.name
  );
}

export interface RobotAvatarProps {
  robot?: Robot | null;
  productionLine?: ProductionLine | null;
  productionLines?: ProductionLine[];
  lineId?: string | null;
  lineCode?: string | null;
  lineName?: string | null;
  colorTheme?: RobotEyeColorTheme;
  customEyeColor?: string;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  showGlow?: boolean;
}

export const RobotAvatar: React.FC<RobotAvatarProps> = ({
  robot,
  productionLine,
  productionLines = [],
  lineId,
  lineCode,
  lineName,
  colorTheme,
  customEyeColor,
  size = 42,
  className = '',
  style = {},
  showGlow = false,
}) => {
  // Resolve theme
  let theme: RobotEyeColorTheme = 'blue';

  if (colorTheme) {
    theme = colorTheme;
  } else if (robot) {
    theme = getRobotThemeForRobot(robot, productionLines);
  } else if (productionLine) {
    theme = getRobotLineTheme(productionLine.id, productionLine.code, productionLine.name);
  } else if (lineId || lineCode || lineName) {
    theme = getRobotLineTheme(lineId, lineCode, lineName);
  }

  const colorConfig = ROBOT_LINE_COLORS[theme] || ROBOT_LINE_COLORS.blue;
  const eyeColor = customEyeColor || colorConfig.primary;
  const mouthColor = eyeColor;

  return (
    <div
      className={`robot-avatar-container ${className}`}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        filter: showGlow ? `drop-shadow(0 0 8px ${colorConfig.glow})` : undefined,
        ...style,
      }}
      title={`${colorConfig.label}`}
    >
      <svg
        viewBox="0 0 512 512"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* Neck Column */}
        <rect
          x="174"
          y="388"
          width="164"
          height="46"
          rx="8"
          fill="#adc8ff"
          stroke="#000000"
          strokeWidth="16"
          strokeLinejoin="round"
        />

        {/* Bottom Shoulders / Torso Base */}
        <path
          d="M 72 494 L 72 466 C 72 446 88 436 108 436 L 404 436 C 424 436 440 446 440 466 L 440 494"
          fill="#537fc9"
          stroke="#000000"
          strokeWidth="16"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Antenna Left */}
        <line
          x1="140"
          y1="58"
          x2="140"
          y2="126"
          stroke="#000000"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <circle
          cx="140"
          cy="54"
          r="22"
          fill="#adc8ff"
          stroke="#000000"
          strokeWidth="16"
        />

        {/* Antenna Right */}
        <line
          x1="372"
          y1="58"
          x2="372"
          y2="126"
          stroke="#000000"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <circle
          cx="372"
          cy="54"
          r="22"
          fill="#adc8ff"
          stroke="#000000"
          strokeWidth="16"
        />

        {/* Top Head Accent Plate */}
        <rect
          x="144"
          y="104"
          width="224"
          height="30"
          rx="8"
          fill="#537fc9"
          stroke="#000000"
          strokeWidth="16"
          strokeLinejoin="round"
        />

        {/* Left Ear */}
        <rect
          x="46"
          y="174"
          width="46"
          height="136"
          rx="18"
          fill="#537fc9"
          stroke="#000000"
          strokeWidth="16"
          strokeLinejoin="round"
        />

        {/* Right Ear */}
        <rect
          x="420"
          y="174"
          width="46"
          height="136"
          rx="18"
          fill="#537fc9"
          stroke="#000000"
          strokeWidth="16"
          strokeLinejoin="round"
        />

        {/* Main Head Box */}
        <rect
          x="94"
          y="122"
          width="324"
          height="270"
          rx="68"
          fill="#adc8ff"
          stroke="#000000"
          strokeWidth="16"
          strokeLinejoin="round"
        />

        {/* Left Eye */}
        <circle
          cx="186"
          cy="244"
          r="48"
          fill={eyeColor}
          stroke="#000000"
          strokeWidth="16"
        />

        {/* Right Eye */}
        <circle
          cx="326"
          cy="244"
          r="48"
          fill={eyeColor}
          stroke="#000000"
          strokeWidth="16"
        />

        {/* Mouth Outer Container */}
        <rect
          x="140"
          y="322"
          width="232"
          height="58"
          rx="8"
          fill="#000000"
        />

        {/* Mouth Glowing Inner Bar */}
        <rect
          x="156"
          y="336"
          width="200"
          height="30"
          rx="4"
          fill={mouthColor}
        />
      </svg>
    </div>
  );
};
