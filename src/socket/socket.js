let io = null;
const { Server } = require("socket.io");
const { customError } = require("../lib/CustomError");

module.exports = {
  initSocket: (server) => {
    io = new Server(server, {
      // ✅ assign to outer variable
      cors: {
        origin: [
          process.env.FRONTEND_URL,
          "http://localhost:3001",
          "http://localhost:5173",
          "http://localhost:3000",
          "http://localhost:5172",
          "http://localhost:5174",
          "https://smartsoftnextjs-ecommerce-git-main-wasim-mahamods-projects.vercel.app",
          "https://smartsoftnextjs-ecommerce.vercel.app",
          "https://z-ecommerce-seven.vercel.app",
        ],
        credentials: true,
      },
    });

    // ====== Socket.IO Setup ======
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });

    io.on("error", (error) => {
      console.error("Socket.IO error:", error);
      throw new customError("Socket.IO error " + error, 500);
    });

    return io;
  },

  getIO: () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
  },
};
