// PM2 Ecosystem Configuration for Production
// This file manages both the backend server and cron worker processes

module.exports = {
  apps: [
    {
      name: 'ubora-backend-prod',
      script: 'server/dev-server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/ubora-backend-prod-error.log',
      out_file: '/var/log/pm2/ubora-backend-prod-out.log',
      log_file: '/var/log/pm2/ubora-backend-prod.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'ubora-backend-dev',
      script: 'server/dev-server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      error_file: '/var/log/pm2/ubora-backend-dev-error.log',
      out_file: '/var/log/pm2/ubora-backend-dev-out.log',
      log_file: '/var/log/pm2/ubora-backend-dev.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001
      }
    },
    {
      name: 'ubora-cron-worker-dev',
      script: 'scripts/cron-worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      error_file: '/var/log/pm2/ubora-cron-worker-dev-error.log',
      out_file: '/var/log/pm2/ubora-cron-worker-dev-out.log',
      log_file: '/var/log/pm2/ubora-cron-worker-dev.log',
      time: true,
      max_memory_restart: '512M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      env_development: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'ubora-cron-worker-prod',
      script: 'scripts/cron-worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/ubora-cron-worker-prod-error.log',
      out_file: '/var/log/pm2/ubora-cron-worker-prod-out.log',
      log_file: '/var/log/pm2/ubora-cron-worker-prod.log',
      time: true,
      max_memory_restart: '512M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ],

  // Development configuration
  deploy: {
    production: {
      user: 'root',
      host: 'your-vps-host',
      ref: 'origin/master',
      repo: 'your-repo-url',
      path: '/var/www/ubora-backend-prod',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    },
    development: {
      user: 'root',
      host: 'your-vps-host',
      ref: 'origin/develop',
      repo: 'your-repo-url',
      path: '/var/www/ubora-backend-dev',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development'
    }
  }
};
