let io = null;
const { Server } = require("socket.io");
const { customError } = require("../lib/CustomError");
const userSockets = new Map();
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
      // Suppose the frontend sends userId in the query when connecting
      const userId = socket.handshake.query.userId;

      console.log("User connected:", userId);

      if (userId) {
        userSockets.set(userId, socket.id);
      }

      socket.on("disconnect", () => {
        if (userId) userSockets.delete(userId);
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
