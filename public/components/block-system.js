// User Blocking System
class BlockSystem {
  constructor(socket) {
    this.socket = socket;
    this.blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
    this.blockedIps = JSON.parse(localStorage.getItem('blockedIps') || '[]');
    this.init();
  }

  init() {
    this.createBlockModal();
    this.createManageModal();
    this.attachEventListeners();
  }

  createBlockModal() {
    const modalHTML = `
      <div id="blockModal" class="block-modal-overlay hidden">
        <div class="block-modal">
          <div class="block-modal-header">
            <h2>Block User</h2>
            <button id="closeBlockBtn" class="close-btn">&times;</button>
          </div>
          <div class="block-modal-body">
            <p>Are you sure you want to block this user?</p>
            <div class="block-info">
              <p><strong>Blocked users cannot:</strong></p>
              <ul>
                <li>Match with you again</li>
                <li>See you in their search results</li>
                <li>Send you messages</li>
              </ul>
            </div>
            <div class="block-options">
              <label class="checkbox-label">
                <input type="checkbox" id="reportBlockCheckbox">
                Also report this user for inappropriate behavior
              </label>
            </div>
            <div class="block-reason hidden" id="blockReasonSection">
              <label for="blockReason">Reason for blocking:</label>
              <select id="blockReason">
                <option value="">Select a reason...</option>
                <option value="harassment">Harassment</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="spam">Spam</option>
                <option value="uncomfortable">Made me uncomfortable</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div class="block-modal-footer">
            <button id="confirmBlockBtn" class="btn btn-danger">Block User</button>
            <button id="cancelBlockBtn" class="btn btn-outline">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  createManageModal() {
    const modalHTML = `
      <div id="manageBlockModal" class="block-modal-overlay hidden">
        <div class="block-modal">
          <div class="block-modal-header">
            <h2>Manage Blocked Users</h2>
            <button id="closeManageBtn" class="close-btn">&times;</button>
          </div>
          <div class="block-modal-body">
            <div id="blockedUsersList">
              <p class="no-blocked-users">You haven't blocked any users yet.</p>
            </div>
          </div>
          <div class="block-modal-footer">
            <button id="clearAllBlocksBtn" class="btn btn-warning">Clear All Blocks</button>
            <button id="closeManageBtnFooter" class="btn btn-outline">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  attachEventListeners() {
    // Block modal listeners
    document.getElementById('closeBlockBtn').addEventListener('click', () => this.hideBlockModal());
    document.getElementById('cancelBlockBtn').addEventListener('click', () => this.hideBlockModal());
    document.getElementById('confirmBlockBtn').addEventListener('click', () => this.confirmBlock());

    // Manage modal listeners
    document.getElementById('closeManageBtn').addEventListener('click', () => this.hideManageModal());
    document.getElementById('closeManageBtnFooter').addEventListener('click', () => this.hideManageModal());
    document.getElementById('clearAllBlocksBtn').addEventListener('click', () => this.clearAllBlocks());

    // Report checkbox listener
    const reportCheckbox = document.getElementById('reportBlockCheckbox');
    reportCheckbox.addEventListener('change', (e) => {
      const reasonSection = document.getElementById('blockReasonSection');
      if (e.target.checked) {
        reasonSection.classList.remove('hidden');
      } else {
        reasonSection.classList.add('hidden');
      }
    });

    // Close modals on outside click
    ['blockModal', 'manageBlockModal'].forEach(modalId => {
      document.getElementById(modalId).addEventListener('click', (e) => {
        if (e.target.id === modalId) {
          this.hideBlockModal();
          this.hideManageModal();
        }
      });
    });
  }

  showBlockModal(userInfo = {}) {
    this.currentUserInfo = userInfo;
    document.getElementById('blockModal').classList.remove('hidden');
    this.resetBlockForm();
  }

  hideBlockModal() {
    document.getElementById('blockModal').classList.add('hidden');
    this.resetBlockForm();
  }

  showManageModal() {
    this.updateBlockedUsersList();
    document.getElementById('manageBlockModal').classList.remove('hidden');
  }

  hideManageModal() {
    document.getElementById('manageBlockModal').classList.add('hidden');
  }

  resetBlockForm() {
    document.getElementById('reportBlockCheckbox').checked = false;
    document.getElementById('blockReasonSection').classList.add('hidden');
    document.getElementById('blockReason').value = '';
  }

  confirmBlock() {
    const shouldReport = document.getElementById('reportBlockCheckbox').checked;
    const reason = document.getElementById('blockReason').value;

    // Block the user
    this.blockUser(this.currentUserInfo);

    // Report if requested
    if (shouldReport && reason) {
      this.socket.emit('report-user', {
        reason: reason,
        description: 'Blocked by user',
        timestamp: new Date().toISOString()
      });
    }

    // Skip to next chat
    this.socket.emit('next');

    this.showNotification('User blocked successfully', 'success');
    this.hideBlockModal();
  }

  blockUser(userInfo) {
    if (!userInfo || !userInfo.id) return;

    if (!this.blockedUsers.includes(userInfo.id)) {
      this.blockedUsers.push(userInfo.id);
      localStorage.setItem('blockedUsers', JSON.stringify(this.blockedUsers));

      // Also block IP if available
      if (userInfo.ip && !this.blockedIps.includes(userInfo.ip)) {
        this.blockedIps.push(userInfo.ip);
        localStorage.setItem('blockedIps', JSON.stringify(this.blockedIps));
      }

      // Notify server about the block
      this.socket.emit('block-user', { userId: userInfo.id });
    }
  }

  unblockUser(userId) {
    const index = this.blockedUsers.indexOf(userId);
    if (index > -1) {
      this.blockedUsers.splice(index, 1);
      localStorage.setItem('blockedUsers', JSON.stringify(this.blockedUsers));
      this.socket.emit('unblock-user', { userId: userId });
      this.updateBlockedUsersList();
      this.showNotification('User unblocked', 'info');
    }
  }

  clearAllBlocks() {
    if (confirm('Are you sure you want to unblock all users? This action cannot be undone.')) {
      this.blockedUsers = [];
      this.blockedIps = [];
      localStorage.setItem('blockedUsers', JSON.stringify(this.blockedUsers));
      localStorage.setItem('blockedIps', JSON.stringify(this.blockedIps));
      this.socket.emit('clear-all-blocks');
      this.updateBlockedUsersList();
      this.showNotification('All blocks cleared', 'info');
    }
  }

  updateBlockedUsersList() {
    const listContainer = document.getElementById('blockedUsersList');
    
    if (this.blockedUsers.length === 0) {
      listContainer.innerHTML = '<p class="no-blocked-users">You haven\'t blocked any users yet.</p>';
      return;
    }

    const listHTML = this.blockedUsers.map(userId => `
      <div class="blocked-user-item">
        <div class="blocked-user-info">
          <span class="blocked-user-id">User ID: ${userId}</span>
          <span class="blocked-date">Blocked: ${this.getBlockDate(userId)}</span>
        </div>
        <button class="btn btn-outline unblock-btn" data-user-id="${userId}">Unblock</button>
      </div>
    `).join('');

    listContainer.innerHTML = listHTML;

    // Attach unblock listeners
    listContainer.querySelectorAll('.unblock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.unblockUser(userId);
      });
    });
  }

  getBlockDate(userId) {
    // This would ideally store the block date, for now return a placeholder
    return 'Recently';
  }

  isUserBlocked(userId) {
    return this.blockedUsers.includes(userId);
  }

  isIpBlocked(ip) {
    return this.blockedIps.includes(ip);
  }

  getBlockedUsers() {
    return [...this.blockedUsers];
  }

  getBlockedIps() {
    return [...this.blockedIps];
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
    }, 5000);
  }

  // Add block management button to UI
  addBlockManagementButton() {
    const controls = document.querySelector('.controls');
    if (controls && !document.getElementById('manageBlocksBtn')) {
      const blockBtn = document.createElement('button');
      blockBtn.id = 'manageBlocksBtn';
      blockBtn.className = 'btn btn-outline';
      blockBtn.textContent = 'Manage Blocks';
      blockBtn.addEventListener('click', () => this.showManageModal());
      controls.appendChild(blockBtn);
    }
  }
}

// Initialize when DOM is ready and socket is available
document.addEventListener('DOMContentLoaded', () => {
  // Wait for socket to be initialized
  setTimeout(() => {
    if (typeof socket !== 'undefined') {
      const blockSystem = new BlockSystem(socket);
      blockSystem.addBlockManagementButton();
    }
  }, 1000);
});
