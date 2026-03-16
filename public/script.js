const socket = io();

// DOM references.
const joinScreen = document.getElementById("joinScreen");
const chatScreen = document.getElementById("chatScreen");
const nameInput = document.getElementById("nameInput");
const genderSelect = document.getElementById("genderSelect");
const startBtn = document.getElementById("startBtn");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteTag = document.getElementById("remoteTag");
const statusBadge = document.getElementById("statusBadge");
const strangerLabel = document.getElementById("strangerLabel");

const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const nextBtn = document.getElementById("nextBtn");
const endBtn = document.getElementById("endBtn");
const reportBtn = document.getElementById("reportBtn");

const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let localStream = null;
let peerConnection = null;
let pendingCandidates = [];
let isMuted = false;
let isCameraOff = false;
let isMatched = false;
let username = "";


const rtcConfig = {
  iceServers: [

    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },

    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },

    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    },

    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject"
    }

  ],

  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  iceTransportPolicy: "all",
  iceCandidatePoolSize: 30
};

function addSystemMessage(text) {
  const node = document.createElement("div");
  node.className = "message system";
  node.textContent = text;
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
}

function addChatMessage(text, type) {
  const node = document.createElement("div");
  node.className = `message ${type}`;
  node.textContent = text;
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
}

function setChatEnabled(enabled) {
  messageInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  reportBtn.disabled = !enabled;
}

async function setupLocalMedia() {

  try {

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localStream = stream;

    const videoTrack = stream.getVideoTracks()[0];

    const newStream = new MediaStream([videoTrack]);

    localVideo.srcObject = newStream;

    localVideo.muted = true;
    localVideo.autoplay = true;
    localVideo.playsInline = true;

    await localVideo.play();

  } catch (err) {

    console.error("Camera error:", err);

  }

}

function buildPeerConnection() {

  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = new RTCPeerConnection(rtcConfig);

  localStream.getTracks().forEach((track) => {

    const sender = peerConnection.addTrack(track, localStream);

    if (track.kind === "video") {

      const params = sender.getParameters();

      if (!params.encodings) params.encodings = [{}];

      params.encodings[0].maxBitrate = 700000;
      params.encodings[0].maxFramerate = 20;

      params.degradationPreference = "maintain-framerate";

      sender.setParameters(params);

    }

  });

  peerConnection.ontrack = (event) => {

    if (remoteVideo.srcObject !== event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }

  };

  peerConnection.onicecandidate = (event) => {

    if (event.candidate) {
      socket.emit("webrtc-ice-candidate", { candidate: event.candidate });
    }

  };

  // Correct place
  peerConnection.onconnectionstatechange = () => {

    console.log("Connection state:", peerConnection.connectionState);

    if (peerConnection.connectionState === "failed") {
      console.log("Restarting ICE");
      peerConnection.restartIce();
    }

  };

}

async function createOffer() {
  buildPeerConnection();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("webrtc-offer", { sdp: offer });
}

async function handleOffer(sdp) {

  buildPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

  // ADD queued ICE candidates
  for (const candidate of pendingCandidates) {

    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

  }

  pendingCandidates = [];

  const answer = await peerConnection.createAnswer();

  await peerConnection.setLocalDescription(answer);

  socket.emit("webrtc-answer", { sdp: answer });

}

async function handleAnswer(sdp) {

  if (!peerConnection) return;

  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

  // Add queued ICE candidates
  for (const candidate of pendingCandidates) {

    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

  }

  pendingCandidates = [];

}

async function handleIceCandidate(candidate) {

  if (!candidate) return;

  if (peerConnection.remoteDescription) {

    try {

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

    } catch (error) {

      console.error("ICE candidate error:", error);

    }

  } else {

    pendingCandidates.push(candidate);

  }

}

function closePeerConnection() {

  pendingCandidates = [];

  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.close();
    peerConnection = null;
  }

  remoteVideo.srcObject = null;

}

async function startChatFlow() {
  const name = nameInput.value.trim() || "Anonymous";
  const gender = genderSelect.value;

  startBtn.disabled = true;

  try {
    if (!localStream) {
      await setupLocalMedia();
    }

    joinScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
    setChatEnabled(false);

    messages.innerHTML = "";
    addSystemMessage("Searching for a random stranger...");
    username = name;
    socket.emit("start-chat", { name, gender });
  } catch (error) {
    alert("Camera/Microphone access is required to start video chat.");
    startBtn.disabled = false;
    console.error(error);
  }
}

startBtn.addEventListener("click", startChatFlow);

muteBtn.addEventListener("click", () => {
  if (!localStream) return;

  isMuted = !isMuted;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !isMuted;
  });
  muteBtn.textContent = isMuted ? "Unmute" : "Mute";
});

cameraBtn.addEventListener("click", () => {
  if (!localStream) return;

  isCameraOff = !isCameraOff;
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = !isCameraOff;
  });
  cameraBtn.textContent = isCameraOff ? "Camera On" : "Camera Off";
});

nextBtn.addEventListener("click", () => {
  addSystemMessage("Moving to next stranger...");
  statusBadge.textContent = "Finding next...";
  strangerLabel.textContent = "Stranger";
  remoteTag.textContent = "Stranger";
  isMatched = false;
  setChatEnabled(false);
  closePeerConnection();
  socket.emit("next");
});

endBtn.addEventListener("click", () => {
  socket.emit("end-chat");

  closePeerConnection();
  statusBadge.textContent = "Chat ended";
  strangerLabel.textContent = "Stranger";
  isMatched = false;
  setChatEnabled(false);

  addSystemMessage("You ended the chat.");

  chatScreen.classList.add("hidden");
  joinScreen.classList.remove("hidden");
  startBtn.disabled = false;
});

reportBtn.addEventListener("click", () => {
  if (!isMatched) return;

  const reason = prompt("Reason for reporting this user:", "Abusive behavior") || "User reported";
  socket.emit("report-user", { reason });
  addSystemMessage("Report submitted.");
});

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendMessage();
});

function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || !isMatched) return;

  socket.emit("chat-message", { 
  name: username,
  message: message
});
  addChatMessage(`You: ${message}`, "self");
  messageInput.value = "";
}
messageInput.addEventListener("input", () => {
  socket.emit("typing", username);
});
socket.on("typing", (name) => {

  const typingBox = document.getElementById("typing");

  if (typingBox) {

    typingBox.innerText = name + " is typing...";

    setTimeout(() => {
      typingBox.innerText = "";
    }, 2000);

  }

});
socket.on("waiting", ({ message }) => {
  statusBadge.textContent = "Waiting...";
  strangerLabel.textContent = "Stranger";
  remoteTag.textContent = "Stranger";
  addSystemMessage(message || "Looking for stranger...");
});

socket.on("matched", async ({ strangerGender, strangerName, shouldInitiateOffer }) => {
  isMatched = true;
  setChatEnabled(true);

  const genderLabel = (strangerGender || "other").replace(/^./, (c) => c.toUpperCase());

  statusBadge.textContent = "Connected";
  strangerLabel.textContent = `Stranger (${genderLabel})`;
  remoteTag.textContent = `Stranger (${genderLabel})`;
  addSystemMessage(`Connected with Stranger (${genderLabel})${strangerName ? `: ${strangerName}` : ""}`);

  if (shouldInitiateOffer) {
    // Delay a bit so both peers complete room setup before signaling.
    setTimeout(() => {
      if (isMatched) createOffer().catch(console.error);
    }, 100);
  }
});

socket.on("webrtc-offer", async ({ sdp }) => {
  try {
    await handleOffer(sdp);
  } catch (error) {
    console.error("Offer handling failed", error);
  }
});

socket.on("webrtc-answer", async ({ sdp }) => {
  try {
    await handleAnswer(sdp);
  } catch (error) {
    console.error("Answer handling failed", error);
  }
});

socket.on("webrtc-ice-candidate", async ({ candidate }) => {
  await handleIceCandidate(candidate);
});

socket.on("chat-message", ({ from, message }) => {
  if (!message) return;
  if (from === socket.id) return; // Ignore echoed own message.
  addChatMessage(`Stranger: ${message}`, "other");
});

socket.on("partner-left", ({ reason }) => {
  isMatched = false;
  setChatEnabled(false);
  closePeerConnection();
  statusBadge.textContent = "Disconnected";
  strangerLabel.textContent = "Stranger";
  remoteTag.textContent = "Stranger";
  addSystemMessage(reason || "Stranger left the chat.");
});

socket.on("chat-ended", ({ message }) => {
  addSystemMessage(message || "Chat ended.");
});
