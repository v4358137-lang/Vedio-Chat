// Simple Referral System
class ReferralSystem {
  constructor(io) {
    this.io = io;
    this.referrals = new Map(); // referralCode -> { referrerId, referredUsers, timestamp }
    this.userReferrals = new Map(); // userId -> referralCode
    this.referralStats = new Map(); // userId -> { successful, pending, total }
    this.rewards = {
      3: 'premium_badge',
      10: 'vip_status',
      25: 'elite_member',
      50: 'legendary_status'
    };
    this.init();
  }

  init() {
    this.loadReferralData();
    this.setupSocketListeners();
  }

  loadReferralData() {
    // In a real implementation, this would load from a database
    // For now, we'll use in-memory storage
    try {
      const savedData = localStorage.getItem('referralData');
      if (savedData) {
        const data = JSON.parse(savedData);
        this.referrals = new Map(data.referrals || []);
        this.userReferrals = new Map(data.userReferrals || []);
        this.referralStats = new Map(data.referralStats || []);
      }
    } catch (error) {
      console.error('Failed to load referral data:', error);
    }
  }

  saveReferralData() {
    // In a real implementation, this would save to a database
    try {
      const data = {
        referrals: Array.from(this.referrals.entries()),
        userReferrals: Array.from(this.userReferrals.entries()),
        referralStats: Array.from(this.referralStats.entries())
      };
      localStorage.setItem('referralData', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save referral data:', error);
    }
  }

  setupSocketListeners() {
    this.io.on('connection', (socket) => {
      // Handle referral visit
      socket.on('referral-visit', (data) => {
        this.handleReferralVisit(socket, data);
      });

      // Handle referral code generation
      socket.on('generate-referral-code', () => {
        this.generateReferralCode(socket);
      });

      // Handle referral stats request
      socket.on('request-referral-stats', () => {
        this.sendReferralStats(socket);
      });

      // Handle referral share tracking
      socket.on('track-referral-share', (data) => {
        this.trackReferralShare(socket, data);
      });

      // Handle user registration (when user starts chat)
      socket.on('start-chat', (data) => {
        this.handleUserRegistration(socket, data);
      });
    });
  }

  handleReferralVisit(socket, data) {
    const { referralCode, timestamp } = data;
    
    // Check if referral code is valid
    const referral = this.referrals.get(referralCode);
    
    if (!referral) {
      socket.emit('referral-error', { message: 'Invalid referral code' });
      return;
    }

    // Check if user already used this referral
    const userId = socket.id;
    if (referral.referredUsers.includes(userId)) {
      socket.emit('referral-error', { message: 'Referral already used' });
      return;
    }

    // Add user to referred users list
    referral.referredUsers.push(userId);
    
    // Update referral stats
    this.updateReferralStats(referral.referrerId, 'pending');
    
    // Save data
    this.saveReferralData();
    
    // Send confirmation
    socket.emit('referral-success', {
      referrerId: referral.referrerId,
      referralCode: referralCode,
      message: 'Referral code applied successfully!'
    });

    // Notify referrer
    this.notifyReferrer(referral.referrerId, {
      type: 'new_referral',
      referredUserId: userId,
      timestamp: timestamp
    });

    console.log('[REFERRAL_VISIT]', {
      referralCode: referralCode,
      referrerId: referral.referrerId,
      referredUserId: userId,
      timestamp: timestamp
    });
  }

  generateReferralCode(socket) {
    const userId = socket.id;
    
    // Check if user already has a referral code
    if (this.userReferrals.has(userId)) {
      const existingCode = this.userReferrals.get(userId);
      socket.emit('referral-code-generated', { code: existingCode });
      return;
    }

    // Generate new referral code
    const code = this.generateUniqueCode();
    
    // Store referral data
    this.referrals.set(code, {
      referrerId: userId,
      referredUsers: [],
      timestamp: new Date().toISOString()
    });
    
    this.userReferrals.set(userId, code);
    
    // Initialize stats if not exists
    if (!this.referralStats.has(userId)) {
      this.referralStats.set(userId, {
        successful: 0,
        pending: 0,
        total: 0,
        rewards: []
      });
    }
    
    // Save data
    this.saveReferralData();
    
    // Send code to user
    socket.emit('referral-code-generated', { code: code });
    
    console.log('[REFERRAL_CODE_GENERATED]', {
      userId: userId,
      referralCode: code,
      timestamp: new Date().toISOString()
    });
  }

  generateUniqueCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    
    do {
      code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.referrals.has(code));
    
    return code;
  }

  handleUserRegistration(socket, userData) {
    const userId = socket.id;
    
    // Check if user has pending referrals to convert
    for (const [code, referral] of this.referrals.entries()) {
      if (referral.referredUsers.includes(userId)) {
        // Convert pending to successful
        this.updateReferralStats(referral.referrerId, 'successful', true);
        
        // Check for rewards
        this.checkAndAwardRewards(referral.referrerId);
        
        console.log('[REFERRAL_CONVERTED]', {
          referralCode: code,
          referrerId: referral.referrerId,
          referredUserId: userId,
          timestamp: new Date().toISOString()
        });
        
        break;
      }
    }
  }

  updateReferralStats(referrerId, type, convertPending = false) {
    if (!this.referralStats.has(referrerId)) {
      this.referralStats.set(referrerId, {
        successful: 0,
        pending: 0,
        total: 0,
        rewards: []
      });
    }

    const stats = this.referralStats.get(referrerId);
    
    if (convertPending && stats.pending > 0) {
      stats.pending--;
      stats.successful++;
    } else if (type === 'pending') {
      stats.pending++;
      stats.total++;
    } else if (type === 'successful') {
      stats.successful++;
      stats.total++;
    }
    
    // Send updated stats to referrer
    this.sendReferralStatsToUser(referrerId);
  }

  checkAndAwardRewards(userId) {
    const stats = this.referralStats.get(userId);
    if (!stats) return;

    const newRewards = [];
    
    for (const [threshold, reward] of Object.entries(this.rewards)) {
      const thresholdNum = parseInt(threshold);
      
      if (stats.successful >= thresholdNum && !stats.rewards.includes(reward)) {
        stats.rewards.push(reward);
        newRewards.push(reward);
      }
    }
    
    if (newRewards.length > 0) {
      // Notify user of new rewards
      this.notifyUser(userId, {
        type: 'reward_earned',
        rewards: newRewards,
        successful: stats.successful
      });
      
      console.log('[REFERRAL_REWARD]', {
        userId: userId,
        rewards: newRewards,
        successfulReferrals: stats.successful,
        timestamp: new Date().toISOString()
      });
    }
    
    this.saveReferralData();
  }

  sendReferralStats(socket) {
    const userId = socket.id;
    const stats = this.referralStats.get(userId) || {
      successful: 0,
      pending: 0,
      total: 0,
      rewards: []
    };
    
    const referralCode = this.userReferrals.get(userId) || null;
    
    socket.emit('referral-stats', {
      stats: stats,
      referralCode: referralCode
    });
  }

  sendReferralStatsToUser(userId) {
    const socket = this.io.sockets.sockets.get(userId);
    if (socket) {
      this.sendReferralStats(socket);
    }
  }

  trackReferralShare(socket, data) {
    const { referralCode, platform, timestamp } = data;
    
    console.log('[REFERRAL_SHARE]', {
      userId: socket.id,
      referralCode: referralCode,
      platform: platform,
      timestamp: timestamp
    });
    
    // In a real implementation, this would track analytics
    socket.emit('referral-share-tracked', { success: true });
  }

  notifyReferrer(referrerId, notification) {
    const socket = this.io.sockets.sockets.get(referrerId);
    if (socket) {
      socket.emit('referral-notification', notification);
    }
  }

  notifyUser(userId, notification) {
    const socket = this.io.sockets.sockets.get(userId);
    if (socket) {
      socket.emit('referral-reward', notification);
    }
  }

  // Get referral analytics
  getReferralAnalytics() {
    const analytics = {
      totalReferrals: 0,
      successfulReferrals: 0,
      pendingReferrals: 0,
      topReferrers: [],
      recentReferrals: [],
      rewardDistribution: {}
    };

    // Calculate totals
    for (const [userId, stats] of this.referralStats.entries()) {
      analytics.totalReferrals += stats.total;
      analytics.successfulReferrals += stats.successful;
      analytics.pendingReferrals += stats.pending;
      
      // Add to top referrers
      analytics.topReferrers.push({
        userId: userId,
        successful: stats.successful,
        total: stats.total,
        rewards: stats.rewards.length
      });
    }

    // Sort top referrers
    analytics.topReferrers.sort((a, b) => b.successful - a.successful);
    analytics.topReferrers = analytics.topReferrers.slice(0, 10);

    // Get recent referrals
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const [code, referral] of this.referrals.entries()) {
      const referralDate = new Date(referral.timestamp);
      if (referralDate > oneWeekAgo) {
        analytics.recentReferrals.push({
          code: code,
          referrerId: referral.referrerId,
          timestamp: referral.timestamp,
          referredCount: referral.referredUsers.length
        });
      }
    }

    // Calculate reward distribution
    for (const [userId, stats] of this.referralStats.entries()) {
      for (const reward of stats.rewards) {
        analytics.rewardDistribution[reward] = (analytics.rewardDistribution[reward] || 0) + 1;
      }
    }

    return analytics;
  }

  // Generate referral report
  generateReferralReport(startDate, endDate) {
    const report = {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      analytics: this.getReferralAnalytics(),
      recommendations: this.generateReferralRecommendations()
    };

    return report;
  }

  generateReferralRecommendations() {
    const recommendations = [];
    const analytics = this.getReferralAnalytics();
    
    if (analytics.pendingReferrals > analytics.successfulReferrals) {
      recommendations.push({
        type: 'conversion',
        priority: 'high',
        message: 'Many pending referrals - consider sending reminders',
        action: 'Implement referral reminder system'
      });
    }
    
    if (analytics.totalReferrals < 100) {
      recommendations.push({
        type: 'promotion',
        priority: 'medium',
        message: 'Low referral activity - consider increasing rewards',
        action: 'Enhance referral rewards program'
      });
    }
    
    return recommendations;
  }

  // Clean up old data
  cleanup() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Clean up old referrals that never converted
    for (const [code, referral] of this.referrals.entries()) {
      const referralDate = new Date(referral.timestamp);
      
      if (referralDate < thirtyDaysAgo && referral.referredUsers.length === 0) {
        this.referrals.delete(code);
        this.userReferrals.delete(referral.referrerId);
      }
    }
    
    this.saveReferralData();
  }
}

// Clean up old data daily
setInterval(() => {
  if (global.referralSystem) {
    global.referralSystem.cleanup();
  }
}, 24 * 60 * 60 * 1000);

module.exports = ReferralSystem;
