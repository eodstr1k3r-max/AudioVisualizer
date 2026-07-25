#!/bin/bash
echo "Stopping PM2 application..."
pm2 stop audio-visualizer-ultimate
pm2 delete audio-visualizer-ultimate
echo "Audio Visualizer stopped."
