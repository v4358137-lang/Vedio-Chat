// Rate Limiting Middleware for Security
const rateLimitStore = new Map();

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
    this.max = options.max || 100; // Max requests per window
    this.message = options.message || 'Too many requests, please try again later.';
    this.standardHeaders = options.standardHeaders !== false;
    this.legacyHeaders = options.legacyHeaders !== false;
    this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
  }

  defaultKeyGenerator(req) {
    // Use IP address as the default key
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  }

  middleware() {
    return (req, res, next) => {
      const key = this.keyGenerator(req);
      const now = Date.now();
      
      // Get or create rate limit record for this key
      let record = rateLimitStore.get(key);
      
      if (!record) {
        record = {
          count: 0,
          resetTime: now + this.windowMs,
          requests: []
        };
        rateLimitStore.set(key, record);
      }

      // Reset if window has expired
      if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + this.windowMs;
        record.requests = [];
      }

      // Increment counter
      record.count++;
      record.requests.push(now);

      // Clean old requests (keep only within window)
      record.requests = record.requests.filter(timestamp => 
        now - timestamp < this.windowMs
      );

      // Check if limit exceeded
      if (record.count > this.max) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        
        // Log rate limit violation
        this.logRateLimitViolation(key, req, record);
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: this.message,
          retryAfter: retryAfter,
          limit: this.max,
          windowMs: this.windowMs
        });
      }

      // Add rate limit headers
      if (this.standardHeaders) {
        res.set({
          'RateLimit-Limit': this.max,
          'RateLimit-Remaining': Math.max(0, this.max - record.count),
          'RateLimit-Reset': new Date(record.resetTime).toISOString()
        });
      }

      if (this.legacyHeaders) {
        res.set({
          'X-RateLimit-Limit': this.max,
          'X-RateLimit-Remaining': Math.max(0, this.max - record.count),
          'X-RateLimit-Reset': Math.ceil(record.resetTime / 1000)
        });
      }

      next();
    };
  }

  logRateLimitViolation(key, req, record) {
    const logData = {
      timestamp: new Date().toISOString(),
      ip: key,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      count: record.count,
      limit: this.max,
      windowMs: this.windowMs
    };

    console.log('[RATE_LIMIT_VIOLATION]', logData);
  }

  // Clean up old records periodically
  static cleanup() {
    const now = Date.now();
    
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }
}

// Predefined rate limiters for different use cases

// General rate limiter for all requests
const generalLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  message: 'Too many requests from this IP, please try again in 15 minutes.'
});

// Strict rate limiter for sensitive operations
const strictLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes
  message: 'Too many attempts, please try again later.'
});

// Chat connection rate limiter
const connectionLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 connections per 5 minutes
  message: 'Too many connection attempts, please wait before trying again.'
});

// Report rate limiter
const reportLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 reports per hour
  message: 'Too many reports submitted, please wait before reporting again.'
});

// Socket.io rate limiting
class SocketIORateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000;
    this.max = options.max || 100;
    this.connections = new Map();
  }

  check(socket, next) {
    const key = socket.handshake.address;
    const now = Date.now();
    
    let record = this.connections.get(key);
    
    if (!record) {
      record = {
        count: 0,
        resetTime: now + this.windowMs
      };
      this.connections.set(key, record);
    }

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + this.windowMs;
    }

    record.count++;

    if (record.count > this.max) {
      console.log('[SOCKET_RATE_LIMIT]', {
        timestamp: new Date().toISOString(),
        ip: key,
        count: record.count,
        limit: this.max
      });
      
      return next(new Error('Rate limit exceeded for socket connections'));
    }

    next();
  }

  static cleanup() {
    const now = Date.now();
    
    for (const [key, record] of this.connections.entries()) {
      if (now > record.resetTime) {
        this.connections.delete(key);
      }
    }
  }
}

// Clean up old records every 5 minutes
setInterval(() => {
  RateLimiter.cleanup();
  SocketIORateLimiter.cleanup();
}, 5 * 60 * 1000);

module.exports = {
  RateLimiter,
  generalLimiter,
  strictLimiter,
  connectionLimiter,
  reportLimiter,
  SocketIORateLimiter
};
