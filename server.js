import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();

app.use(express.static("public"));

io.on("connection", socket => {
  console.log("conn:", socket.id);

  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);
    console.log(`${userName} joined ${roomId}`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { time: 0, playing: false, lastUpdate: Date.now(), hostSocketId: socket.id });
    }

    const state = rooms.get(roomId);
    socket.emit("sync-state", { time: state.time, playing: state.playing, serverTime: Date.now() });
    socket.to(roomId).emit("peer-joined", { socketId: socket.id, userName });
  });

  // Video events
  socket.on("play", ({ roomId, time }) => { const st = rooms.get(roomId)||{}; st.playing=true; st.time=time; st.lastUpdate=Date.now(); rooms.set(roomId,st); socket.to(roomId).emit("play",{time, serverTime:Date.now()}); });
  socket.on("pause", ({ roomId, time }) => { const st = rooms.get(roomId)||{}; st.playing=false; st.time=time; st.lastUpdate=Date.now(); rooms.set(roomId,st); socket.to(roomId).emit("pause",{time, serverTime:Date.now()}); });
  socket.on("seek", ({ roomId, time }) => { const st = rooms.get(roomId)||{}; st.time=time; st.lastUpdate=Date.now(); rooms.set(roomId,st); socket.to(roomId).emit("seek",{time, serverTime:Date.now()}); });

  socket.on("request-sync", ({ roomId }) => {
    const st = rooms.get(roomId);
    if(st) socket.emit("sync-state",{time:st.time, playing:st.playing, serverTime:Date.now()});
  });

  // Chat message
  socket.on('chat-message', ({ roomId, userName, message }) => {
    socket.to(roomId).emit('chat-message', { userName, message });
  });

  socket.on("disconnecting", () => {
    for(const roomId of socket.rooms){
      if(rooms.has(roomId)){
        const st = rooms.get(roomId);
        if(st.hostSocketId === socket.id){ st.hostSocketId = null; rooms.set(roomId, st); }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("listening", PORT));
