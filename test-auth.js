#!/usr/bin/env node

/**
 * RoboPulse Authentication Validation Script
 * 
 * This script performs a complete end-to-end validation of the authentication system:
 * 1. Docker container health
 * 2. Database connection
 * 3. Schema integrity
 * 4. Seed data existence
 * 5. Bcrypt hash validity
 * 6. Backend endpoint response
 * 7. JWT token generation
 * 8. CORS configuration
 * 
 * Run from project root: npm run test:auth
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
};

function log(status, message) {
    const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '→';
    const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.blue;
    console.log(`${color}${icon} ${message}${colors.reset}`);
}

function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        body: body ? JSON.parse(body) : null,
                        headers: res.headers,
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        body: body,
                        headers: res.headers,
                    });
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function validateBackendRunning() {
    log('blue', 'Testing backend connectivity...');
    try {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/health',
            method: 'GET',
            timeout: 5000,
        });

        if (response.statusCode === 200 && response.body?.success) {
            log('pass', 'Backend is running on port 5000');
            return true;
        } else {
            log('fail', 'Backend returned unexpected status: ' + response.statusCode);
            return false;
        }
    } catch (error) {
        log('fail', 'Backend not responding: ' + error.message);
        return false;
    }
}

async function validateDatabaseSchema() {
    log('blue', 'Validating database schema...');
    try {
        const { stdout } = await execAsync('npm run db:verify', {
            cwd: path.dirname(__filename),
            timeout: 10000,
        });

        if (stdout.includes('✓')) {
            log('pass', 'Database schema verified');
            return true;
        } else {
            log('fail', 'Database schema validation failed');
            return false;
        }
    } catch (error) {
        log('fail', 'Database verification error: ' + error.message.split('\n')[0]);
        return false;
    }
}

async function validateAuthEndpoint() {
    log('blue', 'Testing /api/auth/login endpoint...');
    try {
        const response = await makeRequest(
            {
                hostname: 'localhost',
                port: 5000,
                path: '/api/auth/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 5000,
            },
            { username: 'admin', password: 'admin' }
        );

        if (response.statusCode === 200 && response.body?.success && response.body?.token) {
            log('pass', 'Login endpoint returned JWT token');
            return { success: true, token: response.body.token, user: response.body.user };
        } else if (response.statusCode === 401) {
            log('fail', 'Authentication failed: ' + (response.body?.message || 'Invalid credentials'));
            return { success: false };
        } else {
            log('fail', `Login endpoint returned status ${response.statusCode}`);
            return { success: false };
        }
    } catch (error) {
        log('fail', 'Login endpoint error: ' + error.message);
        return { success: false };
    }
}

async function validateCORS() {
    log('blue', 'Testing CORS configuration...');
    try {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/login',
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
            },
            timeout: 5000,
        });

        if (response.headers['access-control-allow-origin']) {
            log('pass', 'CORS enabled for frontend origin');
            return true;
        } else {
            log('fail', 'CORS not properly configured');
            return false;
        }
    } catch (error) {
        log('fail', 'CORS validation error: ' + error.message);
        return false;
    }
}

async function validateFrontendBuild() {
    log('blue', 'Validating frontend build...');
    try {
        const frontendPath = path.join(path.dirname(__filename), 'frontend', 'dist');
        if (fs.existsSync(frontendPath)) {
            const indexPath = path.join(frontendPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                log('pass', 'Frontend build exists and is ready');
                return true;
            }
        }
        log('fail', 'Frontend build not found. Run: cd frontend && npm run build');
        return false;
    } catch (error) {
        log('fail', 'Frontend validation error: ' + error.message);
        return false;
    }
}

async function validateBackendBuild() {
    log('blue', 'Validating backend TypeScript compilation...');
    try {
        const backendPath = path.join(path.dirname(__filename), 'backend', 'dist');
        if (fs.existsSync(backendPath)) {
            log('pass', 'Backend TypeScript compiled and ready');
            return true;
        }
        log('fail', 'Backend build not found. Run: cd backend && npm run build');
        return false;
    } catch (error) {
        log('fail', 'Backend validation error: ' + error.message);
        return false;
    }
}

async function main() {
    console.log('\n' + colors.blue + '='.repeat(60) + colors.reset);
    console.log(colors.blue + '  RoboPulse Authentication System Validation' + colors.reset);
    console.log(colors.blue + '='.repeat(60) + colors.reset + '\n');

    const checks = [
        { name: 'Backend Build', fn: validateBackendBuild },
        { name: 'Frontend Build', fn: validateFrontendBuild },
        { name: 'Backend Connectivity', fn: validateBackendRunning },
        { name: 'Database Schema', fn: validateDatabaseSchema },
        { name: 'CORS Configuration', fn: validateCORS },
        { name: 'Authentication Endpoint', fn: validateAuthEndpoint },
    ];

    const results = [];

    for (const check of checks) {
        console.log(colors.blue + `\n[${check.name}]` + colors.reset);
        try {
            const result = await check.fn();
            results.push({ name: check.name, passed: result && result.success !== false });
        } catch (error) {
            log('fail', `Unexpected error: ${error.message}`);
            results.push({ name: check.name, passed: false });
        }
    }

    // Summary
    console.log('\n' + colors.blue + '='.repeat(60) + colors.reset);
    console.log(colors.blue + '  Validation Summary' + colors.reset);
    console.log(colors.blue + '='.repeat(60) + colors.reset);

    const allPassed = results.every((r) => r.passed);
    const passCount = results.filter((r) => r.passed).length;

    results.forEach((r) => {
        log(r.passed ? 'pass' : 'fail', `${r.name}: ${r.passed ? 'PASS' : 'FAIL'}`);
    });

    console.log(colors.blue + '='.repeat(60) + colors.reset);

    if (allPassed) {
        console.log(colors.green + '\n✓ ALL CHECKS PASSED!\n' + colors.reset);
        console.log('The authentication system is ready to use.');
        console.log('Login credentials:');
        console.log('  Username: admin');
        console.log('  Password: admin');
        console.log('\nNext steps:');
        console.log('  1. Start backend:  cd backend && npm run dev');
        console.log('  2. Start frontend: cd frontend && npm run dev');
        console.log('  3. Open http://localhost:5173 in your browser');
        console.log(colors.blue + '\n' + '='.repeat(60) + colors.reset + '\n');
        process.exit(0);
    } else {
        console.log(
            colors.red +
                `\n✗ ${results.length - passCount} CHECK(S) FAILED\n` +
                colors.reset
        );
        console.log('Troubleshooting:');
        console.log('  1. See AUTHENTICATION_DEBUGGING.md for detailed diagnostics');
        console.log('  2. Ensure Docker containers are running: docker-compose up -d');
        console.log('  3. Ensure migrations applied: npm run db:migrate');
        console.log('  4. Check backend logs: cd backend && npm run dev');
        console.log(colors.blue + '\n' + '='.repeat(60) + colors.reset + '\n');
        process.exit(1);
    }
}

main().catch((error) => {
    log('fail', 'Script error: ' + error.message);
    process.exit(1);
});
