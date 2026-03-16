// TURN Server Configuration Guide and Setup
const turnServerConfig = {
  // Current configuration (using free TURN servers)
  current: {
    iceServers: [
      // STUN servers (free)
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      
      // Free TURN servers (for development/testing)
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ]
  },

  // Production TURN server recommendations
  production: {
    options: [
      {
        name: "Twilio Programmable Video",
        description: "Reliable, scalable TURN server solution",
        pricing: "$0.0045 per participant minute",
        setup: "Requires API key and configuration",
        pros: ["High reliability", "Global coverage", "Excellent documentation"],
        cons: ["Paid service", "Requires setup"],
        config: {
          urls: "turn:global.turn.twilio.com:3478?transport=udp",
          username: "YOUR_TWILIO_USERNAME",
          credential: "YOUR_TWILIO_CREDENTIAL"
        }
      },
      {
        name: "Xirsys",
        description: "WebRTC signaling and TURN server service",
        pricing: "Free tier available, paid plans from $10/month",
        setup: "Sign up and get API credentials",
        pros: ["Easy setup", "Free tier", "Good performance"],
        cons: ["Limited free tier", "Third-party dependency"],
        config: {
          urls: "turn:YOUR_XIRSYS_SERVER:3478",
          username: "YOUR_XIRSYS_USERNAME",
          credential: "YOUR_XIRSYS_CREDENTIAL"
        }
      },
      {
        name: "coturn (Self-hosted)",
        description: "Open-source TURN server you can host yourself",
        pricing: "Free (server costs only)",
        setup: "Deploy on cloud server (AWS, DigitalOcean, etc.)",
        pros: ["Full control", "No recurring fees", "Open source"],
        cons: ["Requires server maintenance", "Technical setup required"],
        config: {
          urls: "turn:YOUR_SERVER_IP:3478",
          username: "YOUR_USERNAME",
          credential: "YOUR_CREDENTIAL"
        }
      },
      {
        name: "Metered TURN",
        description: "TURN server service with generous free tier",
        pricing: "Free tier available, paid from $4.99/month",
        setup: "Simple API key setup",
        pros: ["Easy setup", "Good free tier", "Reliable"],
        cons: ["Limited bandwidth on free tier"],
        config: {
          urls: "turn:openrelay.metered.ca:443",
          username: "YOUR_METERED_USERNAME",
          credential: "YOUR_METERED_CREDENTIAL"
        }
      }
    ]
  },

  // Self-hosted coturn setup guide
  selfHostedSetup: {
    prerequisites: [
      "Linux server (Ubuntu 20.04+ recommended)",
      "Public IP address",
      "Domain name (optional but recommended)",
      "Ports 3478 (UDP/TCP) and 49152-65535 (UDP) open"
    ],

    installationSteps: [
      {
        step: 1,
        title: "Install coturn",
        commands: [
          "sudo apt update",
          "sudo apt install coturn"
        ]
      },
      {
        step: 2,
        title: "Configure TURN server",
        configFile: "/etc/turnserver.conf",
        config: `
# TURN server configuration
listening-port=3478
tls-listening-port=5349
listening-ip=YOUR_SERVER_IP
relay-ip=YOUR_SERVER_IP
external-ip=YOUR_SERVER_IP

# Authentication
use-auth-secret
static-auth-secret=YOUR_LONG_RANDOM_SECRET
realm=yourdomain.com

# User database (if using long-term credentials)
# user=username:password

# Network
total-quota=100
user-quota=12
max-bps=64000

# Security
no-loopback-peers
no-multicast-peers
no-tcp-relay

# Logging
log-file=/var/log/turnserver.log
verbose

# TLS certificates (optional but recommended)
cert=/path/to/cert.pem
pkey=/path/to/private.key
        `
      },
      {
        step: 3,
        title: "Enable and start service",
        commands: [
          "sudo systemctl enable coturn",
          "sudo systemctl start coturn"
        ]
      },
      {
        step: 4,
        title: "Test TURN server",
        testCommand: "turnutils_uclient -T -u YOUR_USERNAME -w YOUR_PASSWORD YOUR_SERVER_IP"
      }
    ]
  },

  // Environment-based configuration
  getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'production':
        return {
          ...this.current,
          iceServers: [
            ...this.current.iceServers,
            // Add production TURN servers here
            ...(process.env.TURN_SERVERS ? JSON.parse(process.env.TURN_SERVERS) : [])
          ]
        };
      
      case 'development':
      default:
        return this.current;
    }
  },

  // Validation function for TURN server configuration
  validateConfig(config) {
    if (!config || !config.iceServers || !Array.isArray(config.iceServers)) {
      return { valid: false, error: 'Invalid iceServers configuration' };
    }

    for (const server of config.iceServers) {
      if (!server.urls) {
        return { valid: false, error: 'Missing urls in ice server configuration' };
      }

      if (server.urls.includes('turn:') && (!server.username || !server.credential)) {
        return { valid: false, error: 'TURN servers require username and credential' };
      }
    }

    return { valid: true };
  },

  // Generate credentials for coturn
  generateCredentials(username, secret) {
    const timestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(username + ':' + timestamp);
    const credential = hmac.digest('base64');
    
    return {
      username: username + ':' + timestamp,
      credential: credential
    };
  }
};

// WebRTC configuration helper
const rtcConfigHelper = {
  // Get optimal configuration for current environment
  getConfig() {
    return turnServerConfig.getEnvironmentConfig();
  },

  // Add TURN server dynamically
  addTurnServer(turnServer) {
    const config = this.getConfig();
    config.iceServers.push(turnServer);
    return config;
  },

  // Test ICE connectivity
  async testConnectivity(config) {
    return new Promise((resolve) => {
      const pc = new RTCPeerConnection(config);
      let success = false;
      
      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.type === 'relay') {
          success = true;
          pc.close();
          resolve({ success: true, message: 'TURN server is reachable' });
        }
      };

      pc.createDataChannel('test');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(err => {
          pc.close();
          resolve({ success: false, error: err.message });
        });

      // Timeout after 10 seconds
      setTimeout(() => {
        pc.close();
        resolve({ 
          success: false, 
          message: success ? 'STUN working but TURN not reachable' : 'No ICE connectivity' 
        });
      }, 10000);
    });
  }
};

module.exports = {
  turnServerConfig,
  rtcConfigHelper
};
