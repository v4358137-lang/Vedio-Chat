// Online User Counter Component
class UserCounter {
  constructor(socket) {
    this.socket = socket;
    this.onlineCount = 0;
    this.waitingCount = 0;
    this.activeChatsCount = 0;
    this.init();
  }

  init() {
    this.createCounterDisplay();
    this.attachEventListeners();
    this.setupSocketListeners();
  }

  createCounterDisplay() {
    const counterHTML = `
      <div id="userCounter" class="user-counter">
        <div class="counter-item">
          <span class="counter-icon">👥</span>
          <div class="counter-info">
            <span class="counter-number" id="onlineCount">0</span>
            <span class="counter-label">Online</span>
          </div>
        </div>
        <div class="counter-item">
          <span class="counter-icon">⏳</span>
          <div class="counter-info">
            <span class="counter-number" id="waitingCount">0</span>
            <span class="counter-label">Waiting</span>
          </div>
        </div>
        <div class="counter-item">
          <span class="counter-icon">💬</span>
          <div class="counter-info">
            <span class="counter-number" id="activeChatsCount">0</span>
            <span class="counter-label">Chatting</span>
          </div>
        </div>
      </div>
    `;

    // Insert counter in the header
    const header = document.querySelector('.topbar');
    if (header) {
      header.insertAdjacentHTML('beforeend', counterHTML);
    }
  }

  attachEventListeners() {
    // Periodically request updated stats
    setInterval(() => {
      this.socket.emit('request-stats');
    }, 30000); // Update every 30 seconds
  }

  setupSocketListeners() {
    this.socket.on('stats-update', (stats) => {
      this.updateCounters(stats);
    });

    this.socket.on('user-connected', (data) => {
      this.onlineCount = data.onlineCount;
      this.updateDisplay();
    });

    this.socket.on('user-disconnected', (data) => {
      this.onlineCount = data.onlineCount;
      this.updateDisplay();
    });

    this.socket.on('waiting-update', (data) => {
      this.waitingCount = data.waitingCount;
      this.updateDisplay();
    });

    this.socket.on('chat-started', (data) => {
      this.activeChatsCount = data.activeChatsCount;
      this.waitingCount = data.waitingCount;
      this.updateDisplay();
    });

    this.socket.on('chat-ended', (data) => {
      this.activeChatsCount = data.activeChatsCount;
      this.updateDisplay();
    });
  }

  updateCounters(stats) {
    this.onlineCount = stats.onlineCount || 0;
    this.waitingCount = stats.waitingCount || 0;
    this.activeChatsCount = stats.activeChatsCount || 0;
    this.updateDisplay();
  }

  updateDisplay() {
    const onlineElement = document.getElementById('onlineCount');
    const waitingElement = document.getElementById('waitingCount');
    const activeChatsElement = document.getElementById('activeChatsCount');

    if (onlineElement) {
      this.animateNumber(onlineElement, this.onlineCount);
    }
    if (waitingElement) {
      this.animateNumber(waitingElement, this.waitingCount);
    }
    if (activeChatsElement) {
      this.animateNumber(activeChatsElement, this.activeChatsCount);
    }

    // Add activity indicator
    this.addActivityIndicator();
  }

  animateNumber(element, targetNumber) {
    const currentNumber = parseInt(element.textContent) || 0;
    const increment = targetNumber > currentNumber ? 1 : -1;
    const steps = Math.abs(targetNumber - currentNumber);
    
    if (steps === 0) return;

    let current = currentNumber;
    const duration = 500; // 500ms animation
    const stepTime = duration / steps;

    const animate = () => {
      current += increment;
      element.textContent = current;

      if (current !== targetNumber) {
        setTimeout(animate, stepTime);
      } else {
        element.classList.add('pulse');
        setTimeout(() => {
          element.classList.remove('pulse');
        }, 300);
      }
    };

    animate();
  }

  addActivityIndicator() {
    const counter = document.getElementById('userCounter');
    if (counter) {
      counter.classList.add('activity-pulse');
      setTimeout(() => {
        counter.classList.remove('activity-pulse');
      }, 1000);
    }
  }

  // Get current stats
  getCurrentStats() {
    return {
      onlineCount: this.onlineCount,
      waitingCount: this.waitingCount,
      activeChatsCount: this.activeChatsCount
    };
  }

  // Format large numbers
  formatNumber(num) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  }

  // Add trend indicators
  addTrendIndicator(element, previousValue, currentValue) {
    const trend = currentValue > previousValue ? 'up' : 
                  currentValue < previousValue ? 'down' : 'stable';
    
    if (trend !== 'stable') {
      const trendHTML = `
        <span class="trend-indicator trend-${trend}">
          ${trend === 'up' ? '📈' : '📉'}
        </span>
      `;
      element.insertAdjacentHTML('afterend', trendHTML);
    }
  }
}

// Initialize when DOM is ready and socket is available
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof socket !== 'undefined') {
      new UserCounter(socket);
    }
  }, 1000);
});
