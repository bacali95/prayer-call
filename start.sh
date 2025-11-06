#!/bin/bash

# Start script for Prayer Call App

echo "Starting Prayer Call App..."

# Store original directory
ORIGINAL_DIR=$(pwd)

# Cleanup function
cleanup() {
    echo ""
    echo "Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    # Return to original directory
    cd "$ORIGINAL_DIR"
    exit 0
}

# Set up trap for cleanup
trap cleanup INT TERM

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create uploads directory if it doesn't exist
mkdir -p uploads

# Start Flask backend in background
echo "Starting Flask backend on port 3001..."
python -m backend.app &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Error: Failed to start Flask backend"
    cleanup
    exit 1
fi

# Start React frontend
echo "Starting React frontend..."
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    yarn install
fi

# Start React app (using dev script from package.json)
yarn dev &
FRONTEND_PID=$!

# Wait a bit for frontend to start
sleep 2

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "Error: Failed to start React frontend"
    cleanup
    exit 1
fi

# Return to original directory
cd "$ORIGINAL_DIR"

echo ""
echo "=========================================="
echo "Prayer Call App is starting!"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "=========================================="

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

