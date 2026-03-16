const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend assets.
app.use(express.static(path.join(__dirname, "public")));

// Waiting pools by gender preference.
const waitingPools = {
  male: [],
  female: [],
  other: []
};

// Track active rooms and user data.
const users = new Map(); // socketId -> { name, gender, roomId, partnerId }
const rooms = new Map(); // roomId -> { a: socketId, b: socketId }

function normalizeGender(input) {
  const value = String(input || "").toLowerCase();
  if (value === "male" || value === "female") return value;
  return "other";
}

function removeFromAllPools(socketId) {
  for (const poolName of Object.keys(waitingPools)) {
    const pool = waitingPools[poolName];
    const index = pool.indexOf(socketId);
    if (index !== -1) pool.splice(index, 1);
  }
}

function makeRoomId(a, b) {
  return `room_${a}_${b}_${Date.now()}`;
}

function joinAsStrangers(socketA, socketB) {
  const roomId = makeRoomId(socketA.id, socketB.id);
  const userA = users.get(socketA.id);
  const userB = users.get(socketB.id);

  if (!userA || !userB) return;

  userA.roomId = roomId;
  userA.partnerId = socketB.id;

  userB.roomId = roomId;
  userB.partnerId = socketA.id;

  rooms.set(roomId, { a: socketA.id, b: socketB.id });

  socketA.join(roomId);
  socketB.join(roomId);

  // Stable initiator selection to avoid offer collisions.
  const aStartsOffer = socketA.id < socketB.id;

  // Tell both users they are matched and share the stranger's gender.
  io.to(socketA.id).emit("matched", {
    roomId,
    strangerGender: userB.gender,
    strangerName: userB.name,
    shouldInitiateOffer: aStartsOffer
  });

  io.to(socketB.id).emit("matched", {
    roomId,
    strangerGender: userA.gender,
    strangerName: userA.name,
    shouldInitiateOffer: !aStartsOffer
  });
}

function tryMatch(socket) {
  const user = users.get(socket.id);
  if (!user) return;

  // Remove stale queue entries first.
  removeFromAllPools(socket.id);

  const myGender = user.gender;
  let partnerId = null;

  // Simple random matching strategy:
  // 1) Prefer opposite/broader pool based on sender gender.
  // 2) Fall back to same pool.
  // 3) Fall back to any available user.
  const preferredPools =
    myGender === "male"
      ? ["female", "other", "male"]
      : myGender === "female"
      ? ["male", "other", "female"]
      : ["male", "female", "other"];

  for (const poolName of preferredPools) {
    const pool = waitingPools[poolName];
    if (pool.length > 0) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      partnerId = pool.splice(randomIndex, 1)[0];
      if (partnerId && partnerId !== socket.id && users.has(partnerId)) {
        break;
      }
      partnerId = null;
    }
  }

  if (!partnerId) {
    // Add me to queue and notify client.
    waitingPools[myGender].push(socket.id);
    io.to(socket.id).emit("waiting", { message: "Looking for a stranger..." });
    return;
  }

  const partnerSocket = io.sockets.sockets.get(partnerId);
  if (!partnerSocket) {
    tryMatch(socket); // Retry if partner vanished.
    return;
  }

  joinAsStrangers(socket, partnerSocket);
}

function detachAndNotify(socketId, reason = "Stranger disconnected") {
  const user = users.get(socketId);
  if (!user) return;

  const { roomId, partnerId } = user;

  removeFromAllPools(socketId);

  user.roomId = null;
  user.partnerId = null;

  if (!roomId || !partnerId) return;

  const room = rooms.get(roomId);
  if (room) rooms.delete(roomId);

  const partner = users.get(partnerId);
  const partnerSocket = io.sockets.sockets.get(partnerId);

  if (partner) {
    partner.roomId = null;
    partner.partnerId = null;
  }

  if (partnerSocket) {
    partnerSocket.leave(roomId);
    io.to(partnerId).emit("partner-left", { reason });
  }
}

io.on("connection", (socket) => {
  socket.on("start-chat", ({ name, gender }) => {
    const cleanName = String(name || "Stranger").trim().slice(0, 30) || "Stranger";
    const cleanGender = normalizeGender(gender);

    users.set(socket.id, {
      name: cleanName,
      gender: cleanGender,
      roomId: null,
      partnerId: null
    });

    tryMatch(socket);
  });

  socket.on("next", () => {
    const user = users.get(socket.id);
    if (!user) return;

    detachAndNotify(socket.id, "Stranger skipped to next chat");
    tryMatch(socket);
  });

  socket.on("end-chat", () => {
    detachAndNotify(socket.id, "Stranger ended the chat");
    removeFromAllPools(socket.id);
    users.delete(socket.id);
    io.to(socket.id).emit("chat-ended", { message: "You ended the chat." });
  });

  socket.on("report-user", (payload) => {
    const reporter = users.get(socket.id);
    if (!reporter || !reporter.partnerId) return;

    // For a free self-hosted build we log reports server-side.
    // You can later store this in DB and add moderation tooling.
    const reported = users.get(reporter.partnerId);
    console.log("[REPORT]", {
      at: new Date().toISOString(),
      reporterId: socket.id,
      reporterName: reporter.name,
      reportedId: reporter.partnerId,
      reportedName: reported?.name || "Unknown",
      reason: payload?.reason || "No reason provided"
    });
  });

  // Relay text chat messages to room partner.
  socket.on("chat-message", ({ message }) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;

    io.to(user.roomId).emit("chat-message", {
      from: socket.id,
      message: String(message || "").slice(0, 500)
    });
  });
socket.on("typing", () => {

  const user = users.get(socket.id);
  if (!user || !user.roomId) return;

  socket.to(user.roomId).emit("typing", user.name);

});

  // Relay WebRTC signaling data.
  socket.on("webrtc-offer", ({ sdp }) => {
    const user = users.get(socket.id);
    if (!user || !user.partnerId) return;
    io.to(user.partnerId).emit("webrtc-offer", { sdp });
  });

  socket.on("webrtc-answer", ({ sdp }) => {
    const user = users.get(socket.id);
    if (!user || !user.partnerId) return;
    io.to(user.partnerId).emit("webrtc-answer", { sdp });
  });

socket.on("webrtc-ice-candidate", ({ candidate }) => {

  const user = users.get(socket.id);

  if (!user || !user.partnerId || !candidate) return;

  io.to(user.partnerId).emit("webrtc-ice-candidate", { candidate });

});

socket.on("disconnect", () => {

  const user = users.get(socket.id);

  detachAndNotify(socket.id, "Stranger disconnected");

  removeFromAllPools(socket.id);

  if (user && user.roomId) {
    rooms.delete(user.roomId);
  }

  users.delete(socket.id);

});
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
