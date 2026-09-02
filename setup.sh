#!/bin/bash
# RoboPulse Quick Setup Script
# Run this script from the project root to set up and verify the database

set -e

echo "========================================="
echo "  RoboPulse Quick Setup"
echo "========================================="
echo ""

# Check if Docker is running
echo "1. Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop."
    exit 1
fi

# Start Docker containers
echo "2. Starting Docker containers..."
docker-compose down 2>/dev/null || true
docker-compose up -d

echo "   Waiting for PostgreSQL to be ready..."
sleep 3

# Run migrations
echo ""
echo "3. Running database migrations..."
npm run db:migrate

# Verify database
echo ""
echo "4. Verifying database..."
npm run db:verify

echo ""
echo "========================================="
echo "  ✓ Setup Complete!"
echo "========================================="
echo ""
echo "  Next steps:"
echo "  1. Start backend:  cd backend && npm run dev"
echo "  2. Start frontend: cd frontend && npm run dev"
echo "  3. Open http://localhost:5173"
echo "  4. Login with: admin / admin"
echo ""
echo "  For troubleshooting, see: AUTHENTICATION_SETUP.md"
echo "========================================="
