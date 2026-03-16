// Camera/Microphone Consent Popup System
class ConsentPopup {
  constructor() {
    this.cameraConsent = localStorage.getItem('cameraConsent') === 'true';
    this.microphoneConsent = localStorage.getItem('microphoneConsent') === 'true';
    this.consentCallbacks = { camera: [], microphone: [] };
    this.init();
  }

  init() {
    this.createConsentModal();
    this.attachEventListeners();
  }

  createConsentModal() {
    const modalHTML = `
      <div id="consentModal" class="consent-modal-overlay hidden">
        <div class="consent-modal">
          <div class="consent-modal-header">
            <h2>📹 Media Permission Required</h2>
          </div>
          <div class="consent-modal-body">
            <div class="consent-intro">
              <p>To use video chat, we need access to your camera and microphone. You have full control over these permissions.</p>
            </div>
            
            <div class="consent-sections">
              <div class="consent-section">
                <div class="consent-item">
                  <label class="consent-label">
                    <input type="checkbox" id="cameraConsentCheckbox">
                    <span class="consent-icon">📹</span>
                    <div class="consent-text">
                      <strong>Camera Access</strong>
                      <p>Allow others to see you during video calls</p>
                    </div>
                  </label>
                  <div class="consent-controls">
                    <button id="testCameraBtn" class="btn btn-outline btn-sm">Test Camera</button>
                  </div>
                </div>
                
                <div class="consent-preview" id="cameraPreview" style="display: none;">
                  <video id="cameraTestVideo" autoplay muted></video>
                  <p>Camera preview</p>
                </div>
              </div>

              <div class="consent-section">
                <div class="consent-item">
                  <label class="consent-label">
                    <input type="checkbox" id="microphoneConsentCheckbox">
                    <span class="consent-icon">🎤</span>
                    <div class="consent-text">
                      <strong>Microphone Access</strong>
                      <p>Allow others to hear you during calls</p>
                    </div>
                  </label>
                  <div class="consent-controls">
                    <button id="testMicrophoneBtn" class="btn btn-outline btn-sm">Test Microphone</button>
                  </div>
                </div>
                
                <div class="consent-preview" id="microphonePreview" style="display: none;">
                  <div class="audio-level-indicator">
                    <div class="audio-level-bar" id="audioLevelBar"></div>
                    <p>Microphone level</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="consent-privacy">
              <h3>🔒 Your Privacy Matters</h3>
              <ul>
                <li>📵 <strong>No recordings:</strong> We never store your video or audio</li>
                <li>👁️ <strong>You're in control:</strong> Disable camera/mic anytime during chat</li>
                <li>🔐 <strong>Peer-to-peer:</strong> Video/audio goes directly to your partner</li>
                <li>📊 <strong>Minimal data:</strong> Only basic usage statistics are collected</li>
              </ul>
            </div>

            <div class="consent-options">
              <label class="remember-consent">
                <input type="checkbox" id="rememberConsentCheckbox">
                Remember my consent for future sessions
              </label>
            </div>
          </div>
          <div class="consent-modal-footer">
            <button id="denyConsentBtn" class="btn btn-outline">Use Without Camera/Mic</button>
            <button id="confirmConsentBtn" class="btn btn-primary" disabled>Allow Access</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  attachEventListeners() {
    const cameraCheckbox = document.getElementById('cameraConsentCheckbox');
    const microphoneCheckbox = document.getElementById('microphoneConsentCheckbox');
    const rememberCheckbox = document.getElementById('rememberConsentCheckbox');
    const confirmBtn = document.getElementById('confirmConsentBtn');
    const denyBtn = document.getElementById('denyConsentBtn');
    const testCameraBtn = document.getElementById('testCameraBtn');
    const testMicrophoneBtn = document.getElementById('testMicrophoneBtn');

    // Checkbox listeners
    cameraCheckbox.addEventListener('change', () => this.updateConfirmButton());
    microphoneCheckbox.addEventListener('change', () => this.updateConfirmButton());

    // Button listeners
    confirmBtn.addEventListener('click', () => this.grantConsent());
    denyBtn.addEventListener('click', () => this.denyConsent());
    testCameraBtn.addEventListener('click', () => this.testCamera());
    testMicrophoneBtn.addEventListener('click', () => this.testMicrophone());

    // Close modal on outside click
    document.getElementById('consentModal').addEventListener('click', (e) => {
      if (e.target.id === 'consentModal') {
        this.denyConsent();
      }
    });
  }

  updateConfirmButton() {
    const cameraCheckbox = document.getElementById('cameraConsentCheckbox');
    const microphoneCheckbox = document.getElementById('microphoneConsentCheckbox');
    const confirmBtn = document.getElementById('confirmConsentBtn');
    
    confirmBtn.disabled = !cameraCheckbox.checked && !microphoneCheckbox.checked;
  }

  showConsentModal(callback = null) {
    this.currentCallback = callback;
    document.getElementById('consentModal').classList.remove('hidden');
    
    // Pre-check previously granted consents
    if (this.cameraConsent) {
      document.getElementById('cameraConsentCheckbox').checked = true;
    }
    if (this.microphoneConsent) {
      document.getElementById('microphoneConsentCheckbox').checked = true;
    }
    
    this.updateConfirmButton();
  }

  hideConsentModal() {
    document.getElementById('consentModal').classList.add('hidden');
    this.stopTests();
  }

  async testCamera() {
    const preview = document.getElementById('cameraPreview');
    const video = document.getElementById('cameraTestVideo');
    const testBtn = document.getElementById('testCameraBtn');

    try {
      testBtn.textContent = 'Testing...';
      testBtn.disabled = true;

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      preview.style.display = 'block';
      
      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (video.srcObject) {
          video.srcObject.getTracks().forEach(track => track.stop());
          video.srcObject = null;
        }
        preview.style.display = 'none';
        testBtn.textContent = 'Test Camera';
        testBtn.disabled = false;
      }, 5000);

    } catch (error) {
      console.error('Camera test failed:', error);
      this.showNotification('Camera test failed. Please check your camera permissions.', 'error');
      testBtn.textContent = 'Test Camera';
      testBtn.disabled = false;
    }
  }

  async testMicrophone() {
    const preview = document.getElementById('microphonePreview');
    const audioBar = document.getElementById('audioLevelBar');
    const testBtn = document.getElementById('testMicrophoneBtn');

    try {
      testBtn.textContent = 'Testing...';
      testBtn.disabled = true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);
      preview.style.display = 'block';

      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const percentage = (average / 255) * 100;
        audioBar.style.width = `${Math.max(percentage, 5)}%`;
      };

      const interval = setInterval(checkAudioLevel, 100);

      // Auto-stop after 5 seconds
      setTimeout(() => {
        clearInterval(interval);
        stream.getTracks().forEach(track => track.stop());
        preview.style.display = 'none';
        testBtn.textContent = 'Test Microphone';
        testBtn.disabled = false;
        audioBar.style.width = '0%';
      }, 5000);

    } catch (error) {
      console.error('Microphone test failed:', error);
      this.showNotification('Microphone test failed. Please check your microphone permissions.', 'error');
      testBtn.textContent = 'Test Microphone';
      testBtn.disabled = false;
    }
  }

  stopTests() {
    const video = document.getElementById('cameraTestVideo');
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    document.getElementById('cameraPreview').style.display = 'none';
    document.getElementById('microphonePreview').style.display = 'none';
  }

  grantConsent() {
    const cameraCheckbox = document.getElementById('cameraConsentCheckbox');
    const microphoneCheckbox = document.getElementById('microphoneConsentCheckbox');
    const rememberCheckbox = document.getElementById('rememberConsentCheckbox');

    this.cameraConsent = cameraCheckbox.checked;
    this.microphoneConsent = microphoneCheckbox.checked;

    if (rememberCheckbox.checked) {
      localStorage.setItem('cameraConsent', this.cameraConsent);
      localStorage.setItem('microphoneConsent', this.microphoneConsent);
    }

    this.hideConsentModal();
    
    if (this.currentCallback) {
      this.currentCallback({
        camera: this.cameraConsent,
        microphone: this.microphoneConsent
      });
    }

    this.showNotification('Media permissions granted', 'success');
  }

  denyConsent() {
    this.hideConsentModal();
    
    if (this.currentCallback) {
      this.currentCallback({
        camera: false,
        microphone: false
      });
    }
  }

  requestConsent(callback) {
    if (this.cameraConsent || this.microphoneConsent) {
      // Consent already granted
      if (callback) {
        callback({
          camera: this.cameraConsent,
          microphone: this.microphoneConsent
        });
      }
    } else {
      // Need to ask for consent
      this.showConsentModal(callback);
    }
  }

  hasCameraConsent() {
    return this.cameraConsent;
  }

  hasMicrophoneConsent() {
    return this.microphoneConsent;
  }

  resetConsent() {
    this.cameraConsent = false;
    this.microphoneConsent = false;
    localStorage.removeItem('cameraConsent');
    localStorage.removeItem('microphoneConsent');
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
}

// Global instance
window.consentPopup = new ConsentPopup();
