// Abuse Logging System
const fs = require('fs');
const path = require('path');

class AbuseLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
    this.logRetentionDays = 30; // Keep logs for 30 days
    this.suspiciousIPs = new Map();
    this.reportedUsers = new Map();
    this.abusePatterns = new Map();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // Log user reports
  logReport(reportData) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'USER_REPORT',
      reporterId: reportData.reporterId,
      reporterName: reportData.reporterName,
      reportedId: reportData.reportedId,
      reportedName: reportData.reportedName,
      reason: reportData.reason,
      description: reportData.description || '',
      reporterIP: reportData.reporterIP,
      reportedIP: reportData.reportedIP,
      userAgent: reportData.userAgent,
      sessionId: reportData.sessionId
    };

    this.writeLog('reports', logEntry);
    this.updateReportedUser(reportData.reportedId, reportData.reason);
    this.checkAbusePatterns(reportData.reportedId, reportData.reason);
  }

  // Log suspicious activities
  logSuspiciousActivity(activityData) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SUSPICIOUS_ACTIVITY',
      ip: activityData.ip,
      userId: activityData.userId,
      activity: activityData.activity,
      severity: activityData.severity || 'medium',
      details: activityData.details || {},
      userAgent: activityData.userAgent,
      sessionId: activityData.sessionId
    };

    this.writeLog('suspicious', logEntry);
    this.updateSuspiciousIP(activityData.ip, activityData.activity);
  }

  // Log connection attempts
  logConnection(connectionData) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'CONNECTION',
      ip: connectionData.ip,
      userId: connectionData.userId,
      action: connectionData.action, // connect, disconnect, reconnect
      success: connectionData.success,
      userAgent: connectionData.userAgent,
      sessionId: connectionData.sessionId,
      duration: connectionData.duration || null
    };

    this.writeLog('connections', logEntry);
  }

  // Log blocked users
  logBlock(blockData) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'USER_BLOCK',
      blockerId: blockData.blockerId,
      blockerName: blockData.blockerName,
      blockedId: blockData.blockedId,
      blockedName: blockData.blockedName,
      reason: blockData.reason || 'User blocked',
      blockerIP: blockData.blockerIP,
      blockedIP: blockData.blockedIP
    };

    this.writeLog('blocks', logEntry);
  }

  // Log rate limit violations
  logRateLimit(rateLimitData) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'RATE_LIMIT',
      ip: rateLimitData.ip,
      endpoint: rateLimitData.endpoint,
      count: rateLimitData.count,
      limit: rateLimitData.limit,
      windowMs: rateLimitData.windowMs,
      userAgent: rateLimitData.userAgent
    };

    this.writeLog('rate_limits', logEntry);
  }

  // Write log entry to file
  writeLog(logType, logEntry) {
    const logFile = path.join(this.logDir, `${logType}-${this.getDateString()}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      fs.appendFileSync(logFile, logLine);
      console.log(`[${logType}]`, logEntry);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  // Get date string for log files
  getDateString(date = new Date()) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Update suspicious IP tracking
  updateSuspiciousIP(ip, activity) {
    if (!this.suspiciousIPs.has(ip)) {
      this.suspiciousIPs.set(ip, {
        count: 0,
        activities: [],
        firstSeen: new Date(),
        lastSeen: new Date()
      });
    }

    const ipData = this.suspiciousIPs.get(ip);
    ipData.count++;
    ipData.activities.push({
      activity: activity,
      timestamp: new Date()
    });
    ipData.lastSeen = new Date();

    // Keep only last 20 activities
    if (ipData.activities.length > 20) {
      ipData.activities.shift();
    }
  }

  // Update reported user tracking
  updateReportedUser(userId, reason) {
    if (!this.reportedUsers.has(userId)) {
      this.reportedUsers.set(userId, {
        count: 0,
        reasons: [],
        firstReported: new Date(),
        lastReported: new Date()
      });
    }

    const userData = this.reportedUsers.get(userId);
    userData.count++;
    userData.reasons.push(reason);
    userData.lastReported = new Date();
  }

  // Check for abuse patterns
  checkAbusePatterns(userId, reason) {
    const key = `${userId}:${reason}`;
    
    if (!this.abusePatterns.has(key)) {
      this.abusePatterns.set(key, {
        count: 0,
        timestamps: []
      });
    }

    const pattern = this.abusePatterns.get(key);
    pattern.count++;
    pattern.timestamps.push(new Date());

    // Keep only last 10 occurrences
    if (pattern.timestamps.length > 10) {
      pattern.timestamps.shift();
    }

    // Check if this is a repeated pattern
    if (pattern.count >= 3) {
      this.logSuspiciousActivity({
        ip: 'unknown',
        userId: userId,
        activity: 'REPEATED_ABUSE_PATTERN',
        severity: 'high',
        details: {
          reason: reason,
          count: pattern.count,
          pattern: 'Multiple reports for same reason'
        }
      });
    }
  }

  // Get abuse statistics
  getAbuseStatistics() {
    const stats = {
      totalReports: 0,
      totalSuspiciousActivities: 0,
      totalBlocks: 0,
      topReportedUsers: [],
      topSuspiciousIPs: [],
      commonReasons: {},
      recentReports: [],
      recentSuspiciousActivities: []
    };

    // Count total reports
    for (const [userId, userData] of this.reportedUsers.entries()) {
      stats.totalReports += userData.count;
      stats.topReportedUsers.push({
        userId: userId,
        count: userData.count,
        lastReported: userData.lastReported
      });
    }

    // Count total suspicious activities
    for (const [ip, ipData] of this.suspiciousIPs.entries()) {
      stats.totalSuspiciousActivities += ipData.count;
      stats.topSuspiciousIPs.push({
        ip: ip,
        count: ipData.count,
        lastSeen: ipData.lastSeen
      });
    }

    // Sort and limit results
    stats.topReportedUsers.sort((a, b) => b.count - a.count).slice(0, 10);
    stats.topSuspiciousIPs.sort((a, b) => b.count - a.count).slice(0, 10);

    return stats;
  }

  // Generate abuse report
  generateAbuseReport(startDate, endDate) {
    const report = {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      statistics: this.getAbuseStatistics(),
      recommendations: this.generateRecommendations()
    };

    // Save report
    const reportFile = path.join(this.logDir, `abuse-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    return report;
  }

  // Generate recommendations based on abuse patterns
  generateRecommendations() {
    const recommendations = [];

    // Check for high-frequency reporters
    for (const [userId, userData] of this.reportedUsers.entries()) {
      if (userData.count >= 5) {
        recommendations.push({
          type: 'USER_INVESTIGATION',
          priority: 'high',
          userId: userId,
          reason: `User reported ${userData.count} times`,
          action: 'Consider temporary suspension'
        });
      }
    }

    // Check for suspicious IPs
    for (const [ip, ipData] of this.suspiciousIPs.entries()) {
      if (ipData.count >= 10) {
        recommendations.push({
          type: 'IP_BLOCK',
          priority: 'medium',
          ip: ip,
          reason: `IP has ${ipData.count} suspicious activities`,
          action: 'Consider IP blocking'
        });
      }
    }

    return recommendations;
  }

  // Clean up old logs
  cleanupOldLogs() {
    const now = new Date();
    const files = fs.readdirSync(this.logDir);

    for (const file of files) {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);
      const daysSinceCreation = (now - stats.mtime) / (1000 * 60 * 60 * 24);

      if (daysSinceCreation > this.logRetentionDays) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old log file: ${file}`);
      }
    }

    // Clean up old in-memory data
    const cutoffTime = now - (this.logRetentionDays * 24 * 60 * 60 * 1000);
    
    for (const [ip, ipData] of this.suspiciousIPs.entries()) {
      if (ipData.lastSeen < cutoffTime) {
        this.suspiciousIPs.delete(ip);
      }
    }

    for (const [userId, userData] of this.reportedUsers.entries()) {
      if (userData.lastReported < cutoffTime) {
        this.reportedUsers.delete(userId);
      }
    }
  }

  // Get logs for specific date range
  getLogs(logType, startDate, endDate) {
    const logs = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const logFile = path.join(this.logDir, `${logType}-${this.getDateString(date)}.log`);
      
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            const logDate = new Date(logEntry.timestamp);
            
            if (logDate >= start && logDate <= end) {
              logs.push(logEntry);
            }
          } catch (error) {
            console.error('Failed to parse log line:', error);
          }
        }
      }
    }

    return logs;
  }
}

// Create global instance
const abuseLogger = new AbuseLogger();

// Clean up old logs daily
setInterval(() => {
  abuseLogger.cleanupOldLogs();
}, 24 * 60 * 60 * 1000);

module.exports = abuseLogger;
