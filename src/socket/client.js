// install first: npm install socket.io-client
const { io } = require("socket.io-client");

// তোমার socket server এর URL
const socket = io("http://localhost:3000", {
  transports: ["websocket"],
  query: { userId: "427e8e5359725e2befde69e1" },
});

// connection successful হলে
socket.on("connect", () => {
  console.log("✅ Connected to server with id:", socket.id);
});

// cart update হলে
socket.on("cartUpdated", (data) => {
  console.log("📩 cartUpdated:", data);
});

socket.on("orderPlaced", (data) => {
  console.log("📩 orderPlaced:", data);
});
// disconnect হলে
socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});

// error হলে
socket.on("connect_error", (err) => {
  console.error("⚠️ Connection error:", err.message);
});
