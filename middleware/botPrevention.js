// Bot Prevention Middleware
const crypto = require('crypto');

class BotPrevention {
  constructor() {
    this.suspiciousIPs = new Set();
    this.challengeStore = new Map();
    this.userAgentBlacklist = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /node/i,
      /perl/i,
      /php/i,
      /ruby/i,
      /go-http/i,
      /postman/i,
      /insomnia/i,
      /httpie/i
    ];
    this.requestPatterns = new Map();
  }

  // Simple CAPTCHA challenge
  generateChallenge() {
    const challenge = {
      id: crypto.randomBytes(16).toString('hex'),
      question: Math.floor(Math.random() * 10) + ' + ' + Math.floor(Math.random() * 10),
      answer: null,
      timestamp: Date.now()
    };
    
    challenge.answer = eval(challenge.question);
    this.challengeStore.set(challenge.id, challenge);
    
    return {
      id: challenge.id,
      question: challenge.question,
      expires: challenge.timestamp + 5 * 60 * 1000 // 5 minutes
    };
  }

  verifyChallenge(challengeId, answer) {
    const challenge = this.challengeStore.get(challengeId);
    
    if (!challenge) {
      return false;
    }

    if (Date.now() > challenge.timestamp + 5 * 60 * 1000) {
      this.challengeStore.delete(challengeId);
      return false;
    }

    const isValid = parseInt(answer) === challenge.answer;
    
    if (isValid) {
      this.challengeStore.delete(challengeId);
    }

    return isValid;
  }

  // Detect suspicious user agents
  isSuspiciousUserAgent(userAgent) {
    if (!userAgent) return true; // No user agent is suspicious
    
    return this.userAgentBlacklist.some(pattern => pattern.test(userAgent));
  }

  // Detect automated request patterns
  detectAutomatedPattern(ip, userAgent) {
    const key = `${ip}:${userAgent}`;
    const now = Date.now();
    
    let pattern = this.requestPatterns.get(key);
    
    if (!pattern) {
      pattern = {
        count: 0,
        timestamps: [],
        intervalVariance: []
      };
      this.requestPatterns.set(key, pattern);
    }

    pattern.count++;
    pattern.timestamps.push(now);

    // Keep only last 20 requests
    if (pattern.timestamps.length > 20) {
      pattern.timestamps.shift();
    }

    // Check for consistent timing (bot-like behavior)
    if (pattern.timestamps.length >= 5) {
      const intervals = [];
      for (let i = 1; i < pattern.timestamps.length; i++) {
        intervals.push(pattern.timestamps[i] - pattern.timestamps[i - 1]);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      const variance = intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;
      
      // Low variance in request intervals suggests automation
      if (variance < 100 && pattern.count > 10) {
        return true;
      }
    }

    // Check for high frequency requests
    if (pattern.timestamps.length >= 10) {
      const timeWindow = pattern.timestamps[pattern.timestamps.length - 1] - pattern.timestamps[0];
      const frequency = pattern.timestamps.length / (timeWindow / 1000); // requests per second
      
      if (frequency > 2) { // More than 2 requests per second
        return true;
      }
    }

    return false;
  }

  // Check if IP is in suspicious list
  isSuspiciousIP(ip) {
    return this.suspiciousIPs.has(ip);
  }

  // Add IP to suspicious list
  addSuspiciousIP(ip, reason = 'Unknown') {
    this.suspiciousIPs.add(ip);
    console.log('[SUSPICIOUS_IP_ADDED]', {
      timestamp: new Date().toISOString(),
      ip: ip,
      reason: reason
    });
  }

  // Remove IP from suspicious list
  removeSuspiciousIP(ip) {
    this.suspiciousIPs.delete(ip);
  }

  // Clean up old challenges and patterns
  cleanup() {
    const now = Date.now();
    
    // Clean expired challenges
    for (const [id, challenge] of this.challengeStore.entries()) {
      if (now > challenge.timestamp + 5 * 60 * 1000) {
        this.challengeStore.delete(id);
      }
    }
    
    // Clean old request patterns
    for (const [key, pattern] of this.requestPatterns.entries()) {
      if (pattern.timestamps.length > 0) {
        const lastRequest = pattern.timestamps[pattern.timestamps.length - 1];
        if (now - lastRequest > 30 * 60 * 1000) { // 30 minutes
          this.requestPatterns.delete(key);
        }
      }
    }
  }

  // Middleware function
  middleware() {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');
      
      // Check if IP is already suspicious
      if (this.isSuspiciousIP(ip)) {
        console.log('[BLOCKED_SUSPICIOUS_IP]', {
          timestamp: new Date().toISOString(),
          ip: ip,
          userAgent: userAgent,
          url: req.url
        });
        
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP has been flagged for suspicious activity'
        });
      }

      // Check user agent
      if (this.isSuspiciousUserAgent(userAgent)) {
        this.addSuspiciousIP(ip, 'Suspicious user agent: ' + userAgent);
        
        console.log('[BLOCKED_SUSPICIOUS_UA]', {
          timestamp: new Date().toISOString(),
          ip: ip,
          userAgent: userAgent,
          url: req.url
        });
        
        return res.status(403).json({
          error: 'Access denied',
          message: 'Automated requests are not allowed'
        });
      }

      // Check request patterns
      if (this.detectAutomatedPattern(ip, userAgent)) {
        this.addSuspiciousIP(ip, 'Automated request pattern detected');
        
        console.log('[BLOCKED_AUTOMATED_PATTERN]', {
          timestamp: new Date().toISOString(),
          ip: ip,
          userAgent: userAgent,
          url: req.url
        });
        
        return res.status(403).json({
          error: 'Access denied',
          message: 'Automated requests detected'
        });
      }

      // Add headers to make bot detection harder
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });

      next();
    };
  }

  // Challenge middleware for sensitive operations
  challengeMiddleware() {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      
      // For sensitive endpoints, require challenge verification
      const sensitiveEndpoints = ['/start-chat', '/report', '/block'];
      const isSensitive = sensitiveEndpoints.some(endpoint => req.path.includes(endpoint));
      
      if (isSensitive) {
        const challengeId = req.get('X-Challenge-ID');
        const challengeAnswer = req.get('X-Challenge-Answer');
        
        if (!challengeId || !challengeAnswer || !this.verifyChallenge(challengeId, challengeAnswer)) {
          const challenge = this.generateChallenge();
          
          return res.status(429).json({
            error: 'Challenge required',
            challenge: challenge,
            message: 'Please solve the challenge to continue'
          });
        }
      }
      
      next();
    };
  }
}

// Clean up old data every 10 minutes
const botPrevention = new BotPrevention();
setInterval(() => {
  botPrevention.cleanup();
}, 10 * 60 * 1000);

module.exports = botPrevention;
