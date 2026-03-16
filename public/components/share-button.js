// Share Website Button Component
class ShareButton {
  constructor() {
    this.init();
  }

  init() {
    this.createShareButton();
    this.attachEventListeners();
  }

  createShareButton() {
    const shareHTML = `
      <div class="share-container">
        <button id="shareBtn" class="btn btn-share">
          <span class="share-icon">🔗</span>
          Share Website
        </button>
        
        <div id="shareMenu" class="share-menu hidden">
          <div class="share-menu-header">
            <h3>Share Find Friends</h3>
            <button id="closeShareMenu" class="close-share-btn">&times;</button>
          </div>
          
          <div class="share-options">
            <button class="share-option" data-platform="twitter">
              <span class="share-option-icon">🐦</span>
              <div class="share-option-text">
                <strong>Twitter</strong>
                <span>Share on Twitter</span>
              </div>
            </button>
            
            <button class="share-option" data-platform="facebook">
              <span class="share-option-icon">📘</span>
              <div class="share-option-text">
                <strong>Facebook</strong>
                <span>Share on Facebook</span>
              </div>
            </button>
            
            <button class="share-option" data-platform="whatsapp">
              <span class="share-option-icon">💬</span>
              <div class="share-option-text">
                <strong>WhatsApp</strong>
                <span>Share on WhatsApp</span>
              </div>
            </button>
            
            <button class="share-option" data-platform="telegram">
              <span class="share-option-icon">✈️</span>
              <div class="share-option-text">
                <strong>Telegram</strong>
                <span>Share on Telegram</span>
              </div>
            </button>
            
            <button class="share-option" data-platform="reddit">
              <span class="share-option-icon">🤖</span>
              <div class="share-option-text">
                <strong>Reddit</strong>
                <span>Share on Reddit</span>
              </div>
            </button>
            
            <button class="share-option" data-platform="copy">
              <span class="share-option-icon">📋</span>
              <div class="share-option-text">
                <strong>Copy Link</strong>
                <span>Copy URL to clipboard</span>
              </div>
            </button>
          </div>
          
          <div class="share-url-container">
            <input type="text" id="shareUrl" readonly value="${window.location.href}">
            <button id="copyUrlBtn" class="btn btn-outline">Copy</button>
          </div>
        </div>
      </div>
    `;

    // Add share button to the controls
    const controls = document.querySelector('.controls');
    if (controls) {
      controls.insertAdjacentHTML('beforeend', shareHTML);
    }
  }

  attachEventListeners() {
    const shareBtn = document.getElementById('shareBtn');
    const closeShareMenu = document.getElementById('closeShareMenu');
    const shareMenu = document.getElementById('shareMenu');
    const copyUrlBtn = document.getElementById('copyUrlBtn');
    const shareOptions = document.querySelectorAll('.share-option');

    shareBtn.addEventListener('click', () => this.toggleShareMenu());
    closeShareMenu.addEventListener('click', () => this.hideShareMenu());
    copyUrlBtn.addEventListener('click', () => this.copyUrl());

    shareOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const platform = e.currentTarget.dataset.platform;
        this.shareOnPlatform(platform);
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.share-container')) {
        this.hideShareMenu();
      }
    });

    // Close menu with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideShareMenu();
      }
    });
  }

  toggleShareMenu() {
    const shareMenu = document.getElementById('shareMenu');
    shareMenu.classList.toggle('hidden');
    
    if (!shareMenu.classList.contains('hidden')) {
      // Update URL input
      document.getElementById('shareUrl').value = window.location.href;
    }
  }

  hideShareMenu() {
    document.getElementById('shareMenu').classList.add('hidden');
  }

  getShareData() {
    const url = window.location.href;
    const title = 'Find Friends - Meet New People Instantly';
    const description = 'Join Find Friends for random video chats with strangers worldwide. Safe, fun, and easy to use!';
    
    return { url, title, description };
  }

  shareOnPlatform(platform) {
    const { url, title, description } = this.getShareData();
    let shareUrl = '';

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title + ' - ' + description)}&url=${encodeURIComponent(url)}`;
        break;
      
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(title + ' - ' + description + ' ' + url)}`;
        break;
      
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title + ' - ' + description)}`;
        break;
      
      case 'reddit':
        shareUrl = `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
        break;
      
      case 'copy':
        this.copyUrl();
        return;
      
      default:
        return;
    }

    // Open share dialog
    this.openShareDialog(shareUrl, platform);
    this.hideShareMenu();
  }

  openShareDialog(url, platform) {
    const width = 600;
    const height = 400;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    const popup = window.open(
      url,
      `share-${platform}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );

    // Fallback for popup blockers
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = url;
    }
  }

  copyUrl() {
    const url = window.location.href;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showCopySuccess();
      }).catch(() => {
        this.fallbackCopyToClipboard(url);
      });
    } else {
      this.fallbackCopyToClipboard(url);
    }
  }

  fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      this.showCopySuccess();
    } catch (err) {
      console.error('Failed to copy text: ', err);
      this.showCopyError();
    }
    
    document.body.removeChild(textArea);
  }

  showCopySuccess() {
    this.showNotification('Link copied to clipboard!', 'success');
    
    // Update button text temporarily
    const copyBtn = document.getElementById('copyUrlBtn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('btn-success');
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.classList.remove('btn-success');
    }, 2000);
  }

  showCopyError() {
    this.showNotification('Failed to copy link', 'error');
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

  // Generate shareable links for specific platforms
  generateShareLinks() {
    const { url, title, description } = this.getShareData();
    
    return {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title + ' - ' + description)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(title + ' - ' + description + ' ' + url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title + ' - ' + description)}`,
      reddit: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
    };
  }

  // Track sharing analytics
  trackShare(platform) {
    // This would typically send analytics data to your server
    console.log('Share tracked:', {
      platform: platform,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ShareButton();
});
