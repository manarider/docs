module.exports = {
  apps: [
    {
      name: 'docs-api',
      script: 'src/app.js',
      cwd: '/data/archives/backend',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4040,
      },
      error_file: '/var/log/pm2/docs-api-error.log',
      out_file: '/var/log/pm2/docs-api-out.log',
      merge_logs: true,
      log_date_format: 'DD/MM/YYYY HH:mm:ss',
      max_size: '50M',
      retain: 7,
      compress: true,
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
