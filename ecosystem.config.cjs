module.exports = {
  apps: [
    {
      name: 'audio-visualizer-ultimate',
      script: 'npx',
      args: 'serve -s dist -l 5174',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
