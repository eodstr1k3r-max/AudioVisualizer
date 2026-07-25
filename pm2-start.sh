#!/bin/bash
echo "Building Audio Visualizer Ultimate..."
npm run build
echo "Starting PM2 application..."
pm2 start ecosystem.config.cjs
echo "Audio Visualizer is running on http://localhost:5174"
