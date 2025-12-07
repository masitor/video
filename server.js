// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// نگهداری وضعیت هر روم در حافظه (برای پروتوتایپ)
const rooms = new Map(); 
// rooms: roomId => { time: number, playing: boolean, lastUpdate: Date.now(), hostSocketId: string|null }

app.use(express.static("public")); // پوشه فرانت‌اند

io.on("connection", socket => {
  console.log("conn:", socket.id);

  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);
    console.log(`${userName} joined ${roomId}`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { time: 0, playing: false, lastUpdate: Date.now(), hostSocketId: socket.id });
    }

    const state = rooms.get(roomId);
    // ارسال state جاری به کاربر جدید
    socket.emit("sync-state", { time: state.time, playing: state.playing, serverTime: Date.now() });

    // اطلاع به دیگران که یک نفر وصل شد (اختیاری UI)
    socket.to(roomId).emit("peer-joined", { socketId: socket.id, userName });
  });

  // دریافت play
  socket.on("play", ({ roomId, time }) => {
    const st = rooms.get(roomId) || {};
    st.playing = true;
    st.time = time;
    st.lastUpdate = Date.now();
    rooms.set(roomId, st);
    // پخشش را به بقیه ارسال کن
    socket.to(roomId).emit("play", { time, serverTime: Date.now() });
  });

  // دریافت pause
  socket.on("pause", ({ roomId, time }) => {
    const st = rooms.get(roomId) || {};
    st.playing = false;
    st.time = time;
    st.lastUpdate = Date.now();
    rooms.set(roomId, st);
    socket.to(roomId).emit("pause", { time, serverTime: Date.now() });
  });

  // seek یا تغییر زمان
  socket.on("seek", ({ roomId, time }) => {
    const st = rooms.get(roomId) || {};
    st.time = time;
    st.lastUpdate = Date.now();
    rooms.set(roomId, st);
    socket.to(roomId).emit("seek", { time, serverTime: Date.now() });
  });

  // کاربر درخواست sync فوری کرد
  socket.on("request-sync", ({ roomId }) => {
    const st = rooms.get(roomId);
    if (st) {
      socket.emit("sync-state", { time: st.time, playing: st.playing, serverTime: Date.now() });
    }
  });

  socket.on("disconnecting", () => {
    // اگر هِست (host) دیسکانکت شد میشه host رو به یک نفر دیگه داد (اختیاری)
    for (const roomId of socket.rooms) {
      if (rooms.has(roomId)) {
        const st = rooms.get(roomId);
        if (st.hostSocketId === socket.id) {
          st.hostSocketId = null;
          rooms.set(roomId, st);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("listening", PORT);
});
