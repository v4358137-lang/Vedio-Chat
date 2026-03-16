module.exports = {
  apps: [{
    name: 'videochat',
    script: 'server.js',
    instances: 'max', // Use all CPU cores for maximum performance
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      UV_THREADPOOL_SIZE: 128 // Optimize for high concurrency
    },
    max_memory_restart: '1G',
    node_args: [
      '--max-old-space-size=1024',
      '--max-semi-space-size=128',
      '--optimize-for-size'
    ],
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    env_production: {
      NODE_ENV: 'production'
    },
    // Performance monitoring
    monitoring: false,
    pmx: true,
    // Kill timeout for graceful shutdown
    kill_timeout: 5000,
    // Wait for listen event before considering app started
    listen_timeout: 3000,
    // Spin up time for cluster
    wait_ready: true,
    // Delay between restarts
    restart_delay: 4000
  }]
};
