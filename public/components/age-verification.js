// Age Verification Component - 18+ Confirmation
class AgeVerification {
  constructor() {
    this.verified = localStorage.getItem('ageVerified') === 'true';
    this.init();
  }

  init() {
    if (!this.verified) {
      this.showModal();
    }
  }

  showModal() {
    const modalHTML = `
      <div id="ageModal" class="age-modal-overlay">
        <div class="age-modal">
          <div class="age-modal-header">
            <h2>🔞 Age Verification Required</h2>
          </div>
          <div class="age-modal-body">
            <p>This platform contains mature content and is intended for adults only.</p>
            <p>You must be <strong>18 years or older</strong> to use this service.</p>
            <div class="age-confirmation">
              <label>
                <input type="checkbox" id="ageCheckbox">
                I confirm that I am 18+ years of age
              </label>
            </div>
            <div class="terms-links">
              <a href="/terms" target="_blank">Terms of Service</a> • 
              <a href="/privacy" target="_blank">Privacy Policy</a>
            </div>
          </div>
          <div class="age-modal-footer">
            <button id="confirmAgeBtn" class="btn btn-primary" disabled>Enter Site</button>
            <button id="denyAgeBtn" class="btn btn-outline">Leave</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.attachEventListeners();
  }

  attachEventListeners() {
    const checkbox = document.getElementById('ageCheckbox');
    const confirmBtn = document.getElementById('confirmAgeBtn');
    const denyBtn = document.getElementById('denyAgeBtn');

    checkbox.addEventListener('change', () => {
      confirmBtn.disabled = !checkbox.checked;
    });

    confirmBtn.addEventListener('click', () => {
      this.verify();
    });

    denyBtn.addEventListener('click', () => {
      this.redirectAway();
    });
  }

  verify() {
    localStorage.setItem('ageVerified', 'true');
    this.verified = true;
    this.hideModal();
  }

  hideModal() {
    const modal = document.getElementById('ageModal');
    if (modal) {
      modal.remove();
    }
  }

  redirectAway() {
    window.location.href = 'https://www.google.com';
  }

  static check() {
    return localStorage.getItem('ageVerified') === 'true';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AgeVerification();
});
