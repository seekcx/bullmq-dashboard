const path = require('path')

module.exports = {
  apps: [
    {
      name: 'bullmq-dashboard',
      script: 'node index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      merge_logs: true,
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      env: {
        ENV_PATH: path.resolve(__dirname, '.env'),
      },
    },
  ],
}
