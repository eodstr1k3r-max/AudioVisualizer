@echo off
echo Building Audio Visualizer Ultimate...
call npm run build
echo Starting PM2 application...
pm2 start ecosystem.config.cjs
echo Audio Visualizer is running on http://localhost:5174
pause
