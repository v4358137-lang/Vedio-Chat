// Invite Friends Link Generator System
class InviteSystem {
  constructor(socket) {
    this.socket = socket;
    this.currentUserId = null;
    this.inviteCode = null;
    this.init();
  }

  init() {
    this.createInviteModal();
    this.attachEventListeners();
    this.loadSavedInviteCode();
  }

  createInviteModal() {
    const modalHTML = `
      <div id="inviteModal" class="invite-modal-overlay hidden">
        <div class="invite-modal">
          <div class="invite-modal-header">
            <h2>🎉 Invite Friends</h2>
            <button id="closeInviteBtn" class="close-btn">&times;</button>
          </div>
          <div class="invite-modal-body">
            <div class="invite-intro">
              <p>Invite your friends to join Find Friends and expand the community!</p>
              <div class="invite-benefits">
                <div class="benefit-item">
                  <span class="benefit-icon">👥</span>
                  <span>More people to chat with</span>
                </div>
                <div class="benefit-item">
                  <span class="benefit-icon">🎁</span>
                  <span>Earn rewards for successful invites</span>
                </div>
                <div class="benefit-item">
                  <span class="benefit-icon">🌟</span>
                  <span>Help grow the community</span>
                </div>
              </div>
            </div>

            <div class="invite-code-section">
              <h3>Your Invite Code</h3>
              <div class="invite-code-display">
                <input type="text" id="inviteCodeInput" readonly value="Loading...">
                <button id="copyInviteBtn" class="btn btn-primary">Copy</button>
              </div>
              <div class="invite-link-display">
                <input type="text" id="inviteLinkInput" readonly value="Loading...">
                <button id="copyLinkBtn" class="btn btn-outline">Copy Link</button>
              </div>
            </div>

            <div class="invite-share-section">
              <h3>Share Your Invite</h3>
              <div class="invite-share-buttons">
                <button class="invite-share-btn" data-platform="whatsapp">
                  <span class="platform-icon">💬</span>
                  WhatsApp
                </button>
                <button class="invite-share-btn" data-platform="telegram">
                  <span class="platform-icon">✈️</span>
                  Telegram
                </button>
                <button class="invite-share-btn" data-platform="twitter">
                  <span class="platform-icon">🐦</span>
                  Twitter
                </button>
                <button class="invite-share-btn" data-platform="email">
                  <span class="platform-icon">📧</span>
                  Email
                </button>
              </div>
            </div>

            <div class="invite-stats-section">
              <h3>Your Invite Stats</h3>
              <div class="invite-stats">
                <div class="stat-item">
                  <span class="stat-number" id="totalInvites">0</span>
                  <span class="stat-label">Total Invites</span>
                </div>
                <div class="stat-item">
                  <span class="stat-number" id="successfulInvites">0</span>
                  <span class="stat-label">Successful</span>
                </div>
                <div class="stat-item">
                  <span class="stat-number" id="pendingInvites">0</span>
                  <span class="stat-label">Pending</span>
                </div>
              </div>
            </div>

            <div class="invite-rewards-section">
              <h3>🏆 Rewards</h3>
              <div class="reward-tiers">
                <div class="reward-tier">
                  <div class="tier-info">
                    <span class="tier-number">3</span>
                    <span class="tier-label">Successful Invites</span>
                  </div>
                  <span class="tier-reward">Premium Badge</span>
                </div>
                <div class="reward-tier">
                  <div class="tier-info">
                    <span class="tier-number">10</span>
                    <span class="tier-label">Successful Invites</span>
                  </div>
                  <span class="tier-reward">VIP Status</span>
                </div>
                <div class="reward-tier">
                  <div class="tier-info">
                    <span class="tier-number">25</span>
                    <span class="tier-label">Successful Invites</span>
                  </div>
                  <span class="tier-reward">Elite Member</span>
                </div>
              </div>
            </div>
          </div>
          <div class="invite-modal-footer">
            <button id="refreshInviteBtn" class="btn btn-outline">Generate New Code</button>
            <button id="closeInviteFooterBtn" class="btn btn-primary">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  attachEventListeners() {
    // Modal controls
    document.getElementById('closeInviteBtn').addEventListener('click', () => this.hideInviteModal());
    document.getElementById('closeInviteFooterBtn').addEventListener('click', () => this.hideInviteModal());
    document.getElementById('refreshInviteBtn').addEventListener('click', () => this.generateNewCode());

    // Copy buttons
    document.getElementById('copyInviteBtn').addEventListener('click', () => this.copyInviteCode());
    document.getElementById('copyLinkBtn').addEventListener('click', () => this.copyInviteLink());

    // Share buttons
    document.querySelectorAll('.invite-share-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const platform = e.currentTarget.dataset.platform;
        this.shareInvite(platform);
      });
    });

    // Close modal on outside click
    document.getElementById('inviteModal').addEventListener('click', (e) => {
      if (e.target.id === 'inviteModal') {
        this.hideInviteModal();
      }
    });
  }

  generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  generateNewCode() {
    this.inviteCode = this.generateInviteCode();
    localStorage.setItem('inviteCode', this.inviteCode);
    this.updateInviteDisplay();
    this.showNotification('New invite code generated!', 'success');
  }

  loadSavedInviteCode() {
    const savedCode = localStorage.getItem('inviteCode');
    if (savedCode) {
      this.inviteCode = savedCode;
    } else {
      this.generateNewCode();
    }
    this.updateInviteDisplay();
  }

  updateInviteDisplay() {
    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}?ref=${this.inviteCode}`;
    
    document.getElementById('inviteCodeInput').value = this.inviteCode;
    document.getElementById('inviteLinkInput').value = inviteUrl;
  }

  copyInviteCode() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(this.inviteCode).then(() => {
        this.showCopySuccess('Code copied!');
      }).catch(() => {
        this.fallbackCopy(this.inviteCode);
      });
    } else {
      this.fallbackCopy(this.inviteCode);
    }
  }

  copyInviteLink() {
    const inviteUrl = `${window.location.origin}?ref=${this.inviteCode}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        this.showCopySuccess('Link copied!');
      }).catch(() => {
        this.fallbackCopy(inviteUrl);
      });
    } else {
      this.fallbackCopy(inviteUrl);
    }
  }

  fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      this.showCopySuccess('Copied!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      this.showCopyError();
    }
    
    document.body.removeChild(textArea);
  }

  showCopySuccess(message) {
    this.showNotification(message, 'success');
  }

  showCopyError() {
    this.showNotification('Failed to copy', 'error');
  }

  shareInvite(platform) {
    const inviteUrl = `${window.location.origin}?ref=${this.inviteCode}`;
    const message = `Join me on Find Friends! It's a fun way to meet new people through video chat. Use my invite code: ${this.inviteCode}`;
    
    let shareUrl = '';

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(message + ' ' + inviteUrl)}`;
        break;
      
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(message)}`;
        break;
      
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(inviteUrl)}`;
        break;
      
      case 'email':
        shareUrl = `mailto:?subject=Join me on Find Friends!&body=${encodeURIComponent(message + '\n\n' + inviteUrl)}`;
        break;
      
      default:
        return;
    }

    this.openShareDialog(shareUrl, platform);
    this.trackInviteShare(platform);
  }

  openShareDialog(url, platform) {
    const width = 600;
    const height = 400;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    const popup = window.open(
      url,
      `invite-${platform}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );

    // Fallback for popup blockers
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = url;
    }
  }

  trackInviteShare(platform) {
    // Send invite tracking to server
    this.socket.emit('track-invite-share', {
      inviteCode: this.inviteCode,
      platform: platform,
      timestamp: new Date().toISOString()
    });
  }

  updateInviteStats(stats) {
    document.getElementById('totalInvites').textContent = stats.totalInvites || 0;
    document.getElementById('successfulInvites').textContent = stats.successfulInvites || 0;
    document.getElementById('pendingInvites').textContent = stats.pendingInvites || 0;
  }

  showInviteModal() {
    document.getElementById('inviteModal').classList.remove('hidden');
    this.updateInviteDisplay();
    
    // Request invite stats from server
    this.socket.emit('request-invite-stats');
  }

  hideInviteModal() {
    document.getElementById('inviteModal').classList.add('hidden');
  }

  showNotification(message, type = 'info') {
    const notificationHTML = `
      <div class="notification notification-${type}">
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', notificationHTML);
    
    const notification = document.querySelector('.notification:last-child');
    const closeBtn = notification.querySelector('.notification-close');
    
    closeBtn.addEventListener('click', () => notification.remove());
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  // Add invite button to UI
  addInviteButton() {
    const controls = document.querySelector('.controls');
    if (controls && !document.getElementById('inviteBtn')) {
      const inviteBtn = document.createElement('button');
      inviteBtn.id = 'inviteBtn';
      inviteBtn.className = 'btn btn-outline';
      inviteBtn.innerHTML = '👥 Invite';
      inviteBtn.addEventListener('click', () => this.showInviteModal());
      controls.appendChild(inviteBtn);
    }
  }

  // Check for referral code in URL
  checkReferralCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
      // Store referral code and notify server
      localStorage.setItem('referralCode', refCode);
      this.socket.emit('referral-visit', {
        referralCode: refCode,
        timestamp: new Date().toISOString()
      });
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show referral notification
      this.showNotification('Welcome! You were invited by a friend.', 'success');
    }
  }
}

// Initialize when DOM is ready and socket is available
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof socket !== 'undefined') {
      const inviteSystem = new InviteSystem(socket);
      inviteSystem.addInviteButton();
      inviteSystem.checkReferralCode();
      
      // Listen for invite stats updates
      socket.on('invite-stats-update', (stats) => {
        inviteSystem.updateInviteStats(stats);
      });
    }
  }, 1000);
});
