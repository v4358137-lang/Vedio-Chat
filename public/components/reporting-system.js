// Enhanced User Reporting System
class ReportingSystem {
  constructor(socket) {
    this.socket = socket;
    this.blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
    this.init();
  }

  init() {
    this.createReportModal();
    this.attachEventListeners();
  }

  createReportModal() {
    const modalHTML = `
      <div id="reportModal" class="report-modal-overlay hidden">
        <div class="report-modal">
          <div class="report-modal-header">
            <h2>Report User</h2>
            <button id="closeReportBtn" class="close-btn">&times;</button>
          </div>
          <div class="report-modal-body">
            <p>Why are you reporting this user?</p>
            <div class="report-reasons">
              <label class="report-option">
                <input type="radio" name="reportReason" value="inappropriate_content">
                <span>Inappropriate content</span>
              </label>
              <label class="report-option">
                <input type="radio" name="reportReason" value="harassment">
                <span>Harassment or bullying</span>
              </label>
              <label class="report-option">
                <input type="radio" name="reportReason" value="spam">
                <span>Spam or scam</span>
              </label>
              <label class="report-option">
                <input type="radio" name="reportReason" value="underage">
                <span>Underage user</span>
              </label>
              <label class="report-option">
                <input type="radio" name="reportReason" value="violence">
                <span>Violence or threats</span>
              </label>
              <label class="report-option">
                <input type="radio" name="reportReason" value="other">
                <span>Other</span>
              </label>
            </div>
            <div class="report-details hidden" id="otherDetails">
              <label for="reportDescription">Please describe the issue:</label>
              <textarea id="reportDescription" maxlength="500" placeholder="Provide additional details..."></textarea>
            </div>
            <div class="report-actions">
              <label class="checkbox-label">
                <input type="checkbox" id="blockUserCheckbox">
                Also block this user
              </label>
            </div>
          </div>
          <div class="report-modal-footer">
            <button id="submitReportBtn" class="btn btn-danger" disabled>Submit Report</button>
            <button id="cancelReportBtn" class="btn btn-outline">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  attachEventListeners() {
    const reportBtn = document.getElementById('reportBtn');
    const closeBtn = document.getElementById('closeReportBtn');
    const cancelBtn = document.getElementById('cancelReportBtn');
    const submitBtn = document.getElementById('submitReportBtn');
    const modal = document.getElementById('reportModal');

    reportBtn.addEventListener('click', () => this.showReportModal());
    closeBtn.addEventListener('click', () => this.hideReportModal());
    cancelBtn.addEventListener('click', () => this.hideReportModal());
    submitBtn.addEventListener('click', () => this.submitReport());

    // Handle radio button changes
    const radioButtons = document.querySelectorAll('input[name="reportReason"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const otherDetails = document.getElementById('otherDetails');
        if (e.target.value === 'other') {
          otherDetails.classList.remove('hidden');
        } else {
          otherDetails.classList.add('hidden');
        }
        this.updateSubmitButton();
      });
    });

    // Handle checkbox changes
    const blockCheckbox = document.getElementById('blockUserCheckbox');
    blockCheckbox.addEventListener('change', () => this.updateSubmitButton());

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideReportModal();
      }
    });
  }

  showReportModal() {
    document.getElementById('reportModal').classList.remove('hidden');
    this.resetForm();
  }

  hideReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
    this.resetForm();
  }

  resetForm() {
    const radioButtons = document.querySelectorAll('input[name="reportReason"]');
    radioButtons.forEach(radio => radio.checked = false);
    document.getElementById('reportDescription').value = '';
    document.getElementById('blockUserCheckbox').checked = false;
    document.getElementById('otherDetails').classList.add('hidden');
    this.updateSubmitButton();
  }

  updateSubmitButton() {
    const submitBtn = document.getElementById('submitReportBtn');
    const selectedReason = document.querySelector('input[name="reportReason"]:checked');
    const blockChecked = document.getElementById('blockUserCheckbox').checked;
    
    submitBtn.disabled = !selectedReason;
  }

  submitReport() {
    const selectedReason = document.querySelector('input[name="reportReason"]:checked');
    const description = document.getElementById('reportDescription').value;
    const shouldBlock = document.getElementById('blockUserCheckbox').checked;

    if (!selectedReason) return;

    const reportData = {
      reason: selectedReason.value,
      description: description || '',
      timestamp: new Date().toISOString(),
      shouldBlock: shouldBlock
    };

    // Send report to server
    this.socket.emit('report-user', reportData);

    // Block user if requested
    if (shouldBlock) {
      this.blockCurrentUser();
    }

    // Show confirmation
    this.showReportConfirmation();
    this.hideReportModal();
  }

  blockCurrentUser() {
    // Get current partner info (this would need to be passed from main app)
    const currentPartner = this.getCurrentPartner();
    if (currentPartner && !this.blockedUsers.includes(currentPartner.id)) {
      this.blockedUsers.push(currentPartner.id);
      localStorage.setItem('blockedUsers', JSON.stringify(this.blockedUsers));
      
      // Skip to next chat
      this.socket.emit('next');
      this.showBlockConfirmation();
    }
  }

  getCurrentPartner() {
    // This should be integrated with the main app to get current partner info
    // For now, return null - this needs to be connected to the main app state
    return null;
  }

  showReportConfirmation() {
    this.showNotification('Report submitted successfully. Thank you for helping keep our community safe.', 'success');
  }

  showBlockConfirmation() {
    this.showNotification('User has been blocked.', 'info');
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

  isUserBlocked(userId) {
    return this.blockedUsers.includes(userId);
  }

  unblockUser(userId) {
    const index = this.blockedUsers.indexOf(userId);
    if (index > -1) {
      this.blockedUsers.splice(index, 1);
      localStorage.setItem('blockedUsers', JSON.stringify(this.blockedUsers));
    }
  }

  getBlockedUsers() {
    return [...this.blockedUsers];
  }
}

// Notification styles
const notificationStyles = `
  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    z-index: 10001;
    max-width: 300px;
    animation: slideInRight 0.3s ease-out;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .notification-success {
    background: #28a745;
  }
  
  .notification-info {
    background: #17a2b8;
  }
  
  .notification-warning {
    background: #ffc107;
    color: #333;
  }
  
  .notification-error {
    background: #dc3545;
  }
  
  .notification-close {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.2rem;
    cursor: pointer;
    margin-left: 1rem;
  }
  
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);
