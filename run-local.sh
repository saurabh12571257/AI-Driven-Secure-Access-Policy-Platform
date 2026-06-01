#!/bin/bash

# SecureAccess AI - Local Dev Server Launcher
# This script boots both the Go API backend and Next.js frontend in parallel.

# Clean up previous tasks on ports 8080 and 3000
echo "🧹 Cleaning up previous server bindings..."
lsof -ti :8080 | xargs kill -9 2>/dev/null
lsof -ti :3000 | xargs kill -9 2>/dev/null
sleep 1

# Setup background termination on Exit
trap 'kill 0' EXIT

echo "🚀 Starting Go Backend API (port 8080)..."
cd backend
go run . &
BACKEND_PID=$!
cd ..

# Wait 2 seconds for backend to initialize database
sleep 2

echo "🚀 Starting Next.js Frontend Dev Server (port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "--------------------------------------------------------"
echo "SecureAccess AI Platform is booting up!"
echo "--------------------------------------------------------"
echo "🌐 Next.js Dashboard UI: http://localhost:3000"
echo "⚙️ Go Backend Rest API:  http://localhost:8080"
echo "--------------------------------------------------------"
echo "Press Ctrl+C to stop both servers."
echo "--------------------------------------------------------"

# Keep the script running
wait
