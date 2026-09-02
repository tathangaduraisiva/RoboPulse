-- ============================================================
-- RoboPulse - Development Seed Data
-- ============================================================

INSERT INTO production_lines
    (id, name, code, description, location)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        'Assembly Line A',
        'ASM-A',
        'Precision component assembly',
        'Plant Floor 1'
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        'Welding Line B',
        'WLD-B',
        'Automated robotic welding',
        'Plant Floor 2'
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        'Painting Line C',
        'PNT-C',
        'Automated surface coating',
        'Plant Floor 3'
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        'Packaging Line D',
        'PKG-D',
        'Automated product packaging',
        'Plant Floor 4'
    );

    INSERT INTO robots
    (
        id,
        line_id,
        name,
        serial_number,
        model,
        manufacturer,
        status,
        installation_date,
        total_runtime_hours
    )
VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'ROBOT-001',
        'RP-ASM-001',
        'KR 10 R1100',
        'KUKA',
        'operational',
        '2024-03-15',
        4821.50
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        'ROBOT-002',
        'RP-ASM-002',
        'IRB 1200',
        'ABB',
        'operational',
        '2024-05-20',
        3914.25
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000002',
        'ROBOT-003',
        'RP-WLD-003',
        'ARC Mate 100iD',
        'FANUC',
        'attention',
        '2023-11-10',
        6217.75
    ),
    (
        '20000000-0000-0000-0000-000000000004',
        '10000000-0000-0000-0000-000000000002',
        'ROBOT-004',
        'RP-WLD-004',
        'TX2-160',
        'Stäubli',
        'operational',
        '2024-01-08',
        5102.00
    ),
    (
        '20000000-0000-0000-0000-000000000005',
        '10000000-0000-0000-0000-000000000003',
        'ROBOT-005',
        'RP-PNT-005',
        'GP25',
        'Yaskawa',
        'operational',
        '2024-07-12',
        2764.50
    ),
    (
        '20000000-0000-0000-0000-000000000006',
        '10000000-0000-0000-0000-000000000003',
        'ROBOT-006',
        'RP-PNT-006',
        'KR 16',
        'KUKA',
        'maintenance',
        '2023-09-22',
        7043.25
    ),
    (
        '20000000-0000-0000-0000-000000000007',
        '10000000-0000-0000-0000-000000000004',
        'ROBOT-007',
        'RP-PKG-007',
        'IRB 2600',
        'ABB',
        'operational',
        '2024-02-17',
        4332.75
    ),
    (
        '20000000-0000-0000-0000-000000000008',
        '10000000-0000-0000-0000-000000000004',
        'ROBOT-008',
        'RP-PKG-008',
        'GP12',
        'Yaskawa',
        'offline',
        '2023-06-05',
        8120.00
    );

    INSERT INTO components
    (
        id,
        robot_id,
        name,
        component_type,
        manufacturer,
        installed_at,
        expected_lifespan_hours,
        current_usage_hours,
        health_score,
        status
    )
VALUES
-- ROBOT-001
(
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Main Drive Motor',
    'Motor',
    'KUKA',
    '2024-03-15',
    12000,
    4821,
    91,
    'healthy'
),
(
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'Joint 2 Bearing',
    'Bearing',
    'SKF',
    '2024-03-15',
    8000,
    4821,
    87,
    'healthy'
),
(
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'Gearbox Assembly',
    'Gearbox',
    'KUKA',
    '2024-03-15',
    10000,
    4821,
    84,
    'healthy'
),

-- ROBOT-002
(
    '30000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000002',
    'Servo Motor',
    'Motor',
    'ABB',
    '2024-05-20',
    10000,
    3914,
    93,
    'healthy'
),
(
    '30000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000002',
    'Wrist Bearing',
    'Bearing',
    'SKF',
    '2024-05-20',
    8000,
    3914,
    89,
    'healthy'
),
(
    '30000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000002',
    'Reduction Gear',
    'Gearbox',
    'ABB',
    '2024-05-20',
    10000,
    3914,
    90,
    'healthy'
),

-- ROBOT-003
(
    '30000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000003',
    'Welding Servo',
    'Motor',
    'FANUC',
    '2023-11-10',
    10000,
    6217,
    73,
    'degrading'
),
(
    '30000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000003',
    'Joint 4 Bearing',
    'Bearing',
    'SKF',
    '2023-11-10',
    7000,
    6217,
    61,
    'degrading'
),
(
    '30000000-0000-0000-0000-000000000009',
    '20000000-0000-0000-0000-000000000003',
    'Welding Gearbox',
    'Gearbox',
    'FANUC',
    '2023-11-10',
    8000,
    6217,
    54,
    'critical'
),

-- ROBOT-004
(
    '30000000-0000-0000-0000-000000000010',
    '20000000-0000-0000-0000-000000000004',
    'Drive Motor',
    'Motor',
    'Stäubli',
    '2024-01-08',
    12000,
    5102,
    88,
    'healthy'
),
(
    '30000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000004',
    'Main Bearing',
    'Bearing',
    'SKF',
    '2024-01-08',
    9000,
    5102,
    85,
    'healthy'
),

-- ROBOT-005
(
    '30000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000005',
    'Paint Arm Motor',
    'Motor',
    'Yaskawa',
    '2024-07-12',
    10000,
    2764,
    95,
    'healthy'
),
(
    '30000000-0000-0000-0000-000000000013',
    '20000000-0000-0000-0000-000000000005',
    'Arm Bearing',
    'Bearing',
    'SKF',
    '2024-07-12',
    8000,
    2764,
    94,
    'healthy'
),

-- ROBOT-006
(
    '30000000-0000-0000-0000-000000000014',
    '20000000-0000-0000-0000-000000000006',
    'Main Servo',
    'Motor',
    'KUKA',
    '2023-09-22',
    10000,
    7043,
    58,
    'degrading'
),
(
    '30000000-0000-0000-0000-000000000015',
    '20000000-0000-0000-0000-000000000006',
    'Gearbox',
    'Gearbox',
    'KUKA',
    '2023-09-22',
    8000,
    7043,
    42,
    'critical'
),

-- ROBOT-007
(
    '30000000-0000-0000-0000-000000000016',
    '20000000-0000-0000-0000-000000000007',
    'Packaging Motor',
    'Motor',
    'ABB',
    '2024-02-17',
    12000,
    4332,
    90,
    'healthy'
),
(
    '30000000-0000-0000-0000-000000000017',
    '20000000-0000-0000-0000-000000000007',
    'Grip Bearing',
    'Bearing',
    'SKF',
    '2024-02-17',
    8000,
    4332,
    88,
    'healthy'
),

-- ROBOT-008
(
    '30000000-0000-0000-0000-000000000018',
    '20000000-0000-0000-0000-000000000008',
    'Main Drive',
    'Motor',
    'Yaskawa',
    '2023-06-05',
    10000,
    8120,
    39,
    'critical'
),
(
    '30000000-0000-0000-0000-000000000019',
    '20000000-0000-0000-0000-000000000008',
    'Wrist Bearing',
    'Bearing',
    'SKF',
    '2023-06-05',
    7000,
    8120,
    28,
    'critical'
);

-- ============================================================
-- SENSOR HISTORY
-- ============================================================

INSERT INTO sensor_readings
    (
        robot_id,
        temperature_c,
        vibration_mm_s,
        motor_current_a,
        pressure_bar,
        recorded_at
    )
SELECT
    r.id,

    ROUND(
        (
            CASE
                WHEN r.name = 'ROBOT-003'
                    THEN 65 + (s.n * 0.55)
                WHEN r.name = 'ROBOT-006'
                    THEN 68 + (s.n * 0.45)
                WHEN r.name = 'ROBOT-008'
                    THEN 70 + (s.n * 0.60)
                ELSE
                    58 + ((s.n % 8) * 0.7)
            END
        )::numeric,
        2
    ),

    ROUND(
        (
            CASE
                WHEN r.name = 'ROBOT-003'
                    THEN 3.8 + (s.n * 0.07)
                WHEN r.name = 'ROBOT-006'
                    THEN 4.2 + (s.n * 0.08)
                WHEN r.name = 'ROBOT-008'
                    THEN 4.8 + (s.n * 0.10)
                ELSE
                    2.8 + ((s.n % 6) * 0.15)
            END
        )::numeric,
        2
    ),

    ROUND(
        (
            8.5 + ((s.n % 5) * 0.35)
        )::numeric,
        2
    ),

    ROUND(
        (
            4.5 + ((s.n % 4) * 0.1)
        )::numeric,
        2
    ),

    NOW() - (s.n || ' hours')::INTERVAL

FROM robots r
CROSS JOIN generate_series(0, 167) AS s(n);

INSERT INTO anomalies
    (
        robot_id,
        anomaly_type,
        severity,
        description,
        status,
        detected_at
    )
VALUES
(
    '20000000-0000-0000-0000-000000000003',
    'Vibration Increase',
    'high',
    'Vibration has remained above the normal operating range for multiple readings.',
    'open',
    NOW() - INTERVAL '8 hours'
),
(
    '20000000-0000-0000-0000-000000000006',
    'Temperature Drift',
    'high',
    'Operating temperature is showing a sustained upward trend.',
    'investigating',
    NOW() - INTERVAL '14 hours'
),
(
    '20000000-0000-0000-0000-000000000008',
    'Excessive Vibration',
    'critical',
    'Vibration level indicates possible mechanical degradation.',
    'open',
    NOW() - INTERVAL '3 hours'
),
(
    '20000000-0000-0000-0000-000000000001',
    'Minor Temperature Spike',
    'low',
    'Short temperature increase detected during operation.',
    'resolved',
    NOW() - INTERVAL '3 days'
);

INSERT INTO maintenance_records
    (
        robot_id,
        component_id,
        maintenance_type,
        description,
        technician,
        cost,
        performed_at,
        next_due_at
    )
VALUES
(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    'preventive',
    'Gearbox lubrication and inspection completed.',
    'Maintenance Team A',
    185.00,
    NOW() - INTERVAL '21 days',
    NOW() + INTERVAL '39 days'
),
(
    '20000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000009',
    'inspection',
    'Gearbox inspected after increased vibration readings.',
    'Maintenance Team B',
    240.00,
    NOW() - INTERVAL '12 days',
    NOW() + INTERVAL '18 days'
),
(
    '20000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000015',
    'component_replacement',
    'Gearbox replacement initiated following condition assessment.',
    'Maintenance Team C',
    1250.00,
    NOW() - INTERVAL '2 days',
    NOW() + INTERVAL '180 days'
),
(
    '20000000-0000-0000-0000-000000000008',
    '30000000-0000-0000-0000-000000000018',
    'corrective',
    'Drive system inspection following critical vibration alert.',
    'Maintenance Team B',
    460.00,
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '25 days'
);

INSERT INTO risk_assessments
    (
        robot_id,
        health_score,
        risk_score,
        risk_level,
        temperature_score,
        vibration_score,
        runtime_score,
        error_score,
        maintenance_score,
        primary_reason,
        recommendation
    )
VALUES
(
    '20000000-0000-0000-0000-000000000001',
    94,
    6,
    'low',
    1,
    1,
    2,
    1,
    1,
    'Normal operating conditions',
    'Continue normal monitoring.'
),
(
    '20000000-0000-0000-0000-000000000002',
    91,
    9,
    'low',
    2,
    2,
    2,
    1,
    2,
    'Slight increase in operating load',
    'Continue routine monitoring.'
),
(
    '20000000-0000-0000-0000-000000000003',
    63,
    37,
    'high',
    8,
    15,
    6,
    5,
    3,
    'Increasing vibration trend',
    'Inspect welding gearbox within 7 days.'
),
(
    '20000000-0000-0000-0000-000000000004',
    88,
    12,
    'low',
    3,
    2,
    4,
    1,
    2,
    'Stable operating profile',
    'Continue normal monitoring.'
),
(
    '20000000-0000-0000-0000-000000000005',
    96,
    4,
    'low',
    1,
    1,
    1,
    0,
    1,
    'Healthy component profile',
    'Continue normal monitoring.'
),
(
    '20000000-0000-0000-0000-000000000006',
    51,
    49,
    'high',
    13,
    17,
    9,
    5,
    5,
    'Temperature and gearbox degradation',
    'Complete gearbox maintenance before returning to full operation.'
),
(
    '20000000-0000-0000-0000-000000000007',
    89,
    11,
    'low',
    3,
    2,
    3,
    1,
    2,
    'Stable operating profile',
    'Continue normal monitoring.'
),
(
    '20000000-0000-0000-0000-000000000008',
    34,
    66,
    'critical',
    18,
    25,
    12,
    7,
    4,
    'Excessive vibration and high runtime',
    'Immediate mechanical inspection recommended.'
);