module.exports = {
  apps: [
    {
      name: 'api-gateway',
      script: 'dist/server.js',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
