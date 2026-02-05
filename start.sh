#!/bin/bash

# Business Plan Review App Startup Script
# =======================================

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Business Plan Review App                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Navigate to app directory
cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Get local IP for iPhone access
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")

echo "🚀 Starting server..."
echo ""
echo "📱 Access the app:"
echo "   • Mac:    http://localhost:3000"
echo "   • iPhone: http://$LOCAL_IP:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo "─────────────────────────────────────────────────────────────"
echo ""

# Start the server
npm start
