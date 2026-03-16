# Integration Guide - Legal, Safety & Popularity Features

This guide shows how to integrate all the new features into your existing video chat application without breaking your current functionality.

## 📋 Overview

All features are designed to be **non-breaking** and can be added incrementally. They exist in separate files and modules that don't modify your core logic.

## 🚀 Quick Start

### 1. Add New Routes to Server.js

Add these routes to your existing `server.js` **before** the socket.io connection handler:

```javascript
// Add these routes after app.use(express.static(...)) and before io.on('connection', ...)

// Legal pages
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/landing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// API endpoints for new features
app.get('/api/stats', (req, res) => {
  res.json({
    onlineCount: users.size,
    waitingCount: Object.values(waitingPools).reduce((sum, pool) => sum + pool.length, 0),
    activeChatsCount: rooms.size
  });
});
```

### 2. Add Security Middleware

Add these middleware imports and usage **before** your existing routes:

```javascript
// Add at the top of server.js
const { generalLimiter, reportLimiter, connectionLimiter } = require('./middleware/rateLimiter');
const botPrevention = require('./middleware/botPrevention');
const abuseLogger = require('./utils/abuseLogger');

// Add middleware before app.use(express.static(...))
app.use(botPrevention.middleware());
app.use(generalLimiter.middleware());

// Apply stricter limits to sensitive endpoints
app.use('/api/report', reportLimiter.middleware());
app.use('/api/connect', connectionLimiter.middleware());
```

### 3. Enhanced Socket.io Event Handlers

Add these new event handlers **inside** your existing `io.on('connection', ...)` block:

```javascript
// Add these inside your socket connection handler

// Stats tracking
socket.on('request-stats', () => {
  socket.emit('stats-update', {
    onlineCount: users.size,
    waitingCount: Object.values(waitingPools).reduce((sum, pool) => sum + pool.length, 0),
    activeChatsCount: rooms.size
  });
});

// Enhanced reporting with abuse logging
socket.on('report-user', (payload) => {
  const reporter = users.get(socket.id);
  if (!reporter || !reporter.partnerId) return;

  const reported = users.get(reporter.partnerId);
  
  // Log to abuse system
  abuseLogger.logReport({
    reporterId: socket.id,
    reporterName: reporter.name,
    reportedId: reporter.partnerId,
    reportedName: reported?.name || "Unknown",
    reason: payload?.reason || "No reason provided",
    description: payload?.description || '',
    reporterIP: socket.handshake.address,
    reportedIP: io.sockets.sockets.get(reporter.partnerId)?.handshake.address,
    userAgent: socket.handshake.headers['user-agent'],
    sessionId: socket.id
  });

  // Your existing report logging
  console.log("[REPORT]", {
    at: new Date().toISOString(),
    reporterId: socket.id,
    reporterName: reporter.name,
    reportedId: reporter.partnerId,
    reportedName: reported?.name || "Unknown",
    reason: payload?.reason || "No reason provided"
  });
});

// Block functionality
socket.on('block-user', (data) => {
  const user = users.get(socket.id);
  if (user && data.userId) {
    abuseLogger.logBlock({
      blockerId: socket.id,
      blockerName: user.name,
      blockedId: data.userId,
      blockedName: data.blockedName || "Unknown",
      reason: data.reason || "User blocked",
      blockerIP: socket.handshake.address,
      blockedIP: data.blockedIP || "Unknown"
    });
  }
});

// Connection logging
socket.on('start-chat', (data) => {
  abuseLogger.logConnection({
    ip: socket.handshake.address,
    userId: socket.id,
    action: 'connect',
    success: true,
    userAgent: socket.handshake.headers['user-agent'],
    sessionId: socket.id
  });

  // Your existing start-chat logic here...
});

socket.on('disconnect', () => {
  abuseLogger.logConnection({
    ip: socket.handshake.address,
    userId: socket.id,
    action: 'disconnect',
    success: true,
    userAgent: socket.handshake.headers['user-agent'],
    sessionId: socket.id
  });

  // Your existing disconnect logic here...
});
```

### 4. Update Main HTML File

Add these script and style includes to your `public/index.html` **before** your existing script:

```html
<!-- Add these in the <head> section -->
<link rel="stylesheet" href="/components/age-verification.css">
<link rel="stylesheet" href="/components/reporting-system.css">
<link rel="stylesheet" href="/components/block-system.css">
<link rel="stylesheet" href="/components/consent-popup.css">
<link rel="stylesheet" href="/components/user-counter.css">
<link rel="stylesheet" href="/components/share-button.css">
<link rel="stylesheet" href="/components/invite-system.css">

<!-- Add these before your existing script.js -->
<script src="/components/age-verification.js"></script>
<script src="/components/consent-popup.js"></script>
<script src="/components/user-counter.js"></script>
<script src="/components/share-button.js"></script>
<script src="/components/invite-system.js"></script>
<script src="/components/reporting-system.js"></script>
<script src="/components/block-system.js"></script>
```

### 5. Update Your Main Script

Add these enhancements to your `public/script.js` **after** your existing socket initialization:

```javascript
// Add after const socket = io();

// Enhanced WebRTC config with TURN server suggestions
const { rtcConfigHelper } = require('../config/turn-servers');
const rtcConfig = rtcConfigHelper.getConfig();

// Replace your existing rtcConfig with the enhanced one
// Or merge: Object.assign(rtcConfig, rtcConfigHelper.getConfig());

// Media consent before accessing camera/microphone
async function startMedia() {
  return new Promise((resolve) => {
    window.consentPopup.requestConsent((consent) => {
      if (consent.camera || consent.microphone) {
        // Your existing getUserMedia logic here
        navigator.mediaDevices.getUserMedia({
          video: consent.camera,
          audio: consent.microphone
        }).then(resolve).catch(resolve);
      } else {
        resolve(null);
      }
    });
  });
}

// Update your media initialization to use consent
// Replace your existing localStream initialization with:
startMedia().then(stream => {
  if (stream) {
    localStream = stream;
    localVideo.srcObject = stream;
  }
  // Continue with your existing logic
});
```

## 🔧 Feature-by-Feature Integration

### ✅ Age Verification (Required)
- **Files**: `age-verification.js`, `age-verification.css`
- **Integration**: Automatically included via script tag
- **Impact**: Blocks users under 18 from accessing the site

### ✅ Terms & Privacy Pages
- **Files**: `terms.html`, `privacy.html`
- **Integration**: Add routes in server.js
- **Impact**: Legal compliance

### ✅ Enhanced Reporting System
- **Files**: `reporting-system.js`, `reporting-system.css`
- **Integration**: Add socket event handlers and script include
- **Impact**: Better user reporting with categories and blocking

### ✅ Block System
- **Files**: `block-system.js`, `block-system.css`
- **Integration**: Add socket event handlers and script include
- **Impact**: Users can permanently block others

### ✅ Media Consent Popup
- **Files**: `consent-popup.js`, `consent-popup.css`
- **Integration**: Update media initialization logic
- **Impact**: Explicit consent before camera/microphone access

### ✅ Rate Limiting
- **Files**: `rateLimiter.js`
- **Integration**: Add middleware to server.js
- **Impact**: Prevents abuse and bot attacks

### ✅ Bot Prevention
- **Files**: `botPrevention.js`
- **Integration**: Add middleware to server.js
- **Impact**: Blocks automated requests

### ✅ TURN Server Configuration
- **Files**: `turn-servers.js`
- **Integration**: Update WebRTC configuration
- **Impact**: Better connectivity for users behind NAT

### ✅ Abuse Logging
- **Files**: `abuseLogger.js`
- **Integration**: Add logging calls to socket handlers
- **Impact**: Comprehensive abuse tracking

### ✅ Online User Counter
- **Files**: `user-counter.js`, `user-counter.css`
- **Integration**: Add script include and socket handlers
- **Impact**: Shows real-time user statistics

### ✅ Share Button
- **Files**: `share-button.js`, `share-button.css`
- **Integration**: Add script include
- **Impact**: Users can share the website easily

### ✅ Invite System
- **Files**: `invite-system.js`, `invite-system.css`, `referralSystem.js`
- **Integration**: Add script includes and socket handlers
- **Impact**: Referral system with rewards

### ✅ SEO Landing Page
- **Files**: `landing.html`
- **Integration**: Add route to server.js
- **Impact**: Better SEO and user acquisition

## 📦 Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "express": "^4.21.2",
    "socket.io": "^4.8.1",
    "crypto": "built-in",
    "fs": "built-in",
    "path": "built-in"
  }
}
```

## 🧪 Testing

### Test Each Feature Individually:

1. **Age Verification**: Clear localStorage and reload
2. **Reporting**: Test report modal and block functionality
3. **Media Consent**: Test camera/microphone permission flow
4. **Rate Limiting**: Make rapid requests to test limits
5. **Share/Invite**: Test all sharing platforms
6. **User Counter**: Verify real-time updates

### Integration Testing:

1. Start with just age verification
2. Add reporting system
3. Add security middleware
4. Add popularity features
5. Test complete system

## 🚨 Important Notes

### ✅ What's Safe (No Breaking Changes):
- All new files are separate from existing code
- Socket.io events are additive (new events don't affect existing ones)
- Middleware is layered, doesn't replace existing logic
- HTML includes are additive
- CSS is scoped to specific components

### ⚠️ Requires Careful Integration:
- WebRTC configuration updates
- Media initialization logic
- Socket event handler additions
- Server route additions

### ❌ Do Not Modify:
- Core matchmaking logic (`tryMatch`, `joinAsStrangers`)
- WebRTC signaling logic (`webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`)
- Room management (`detachAndNotify`)
- User management (`users`, `rooms` Maps)

## 🔒 Security Considerations

1. **Rate Limits**: Adjust limits based on your traffic
2. **TURN Servers**: Replace free TURN servers with paid ones for production
3. **Abuse Logs**: Monitor logs regularly and set up alerts
4. **Bot Prevention**: Tune detection thresholds based on your user base

## 📈 Monitoring

Set up monitoring for:
- Rate limit violations
- Abuse reports
- Failed connections
- Bot detection alerts
- Referral conversion rates

## 🎯 Rollout Strategy

1. **Phase 1**: Legal features (age verification, terms, privacy)
2. **Phase 2**: Safety features (reporting, blocking, consent)
3. **Phase 3**: Security features (rate limiting, bot prevention)
4. **Phase 4**: Popularity features (sharing, invites, landing page)

Each phase can be deployed independently without affecting the others.

## 🆘 Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Verify all file paths are correct
3. Ensure middleware is loaded in correct order
4. Test features individually before combining
5. Check that socket events are properly handled

All features are designed to fail gracefully - if a feature doesn't work, your core chat functionality remains unaffected.
