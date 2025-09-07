let io = null;
const { Server } = require("socket.io");
const { customError } = require("../lib/CustomError");

module.exports = {
  initSocket: (server) => {
    io = new Server(server, {
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
      const userId = socket.handshake.query.userId;
      console.log("User connected socket.handshake.query.userId:", userId);

      if (userId) {
        // ✅ User নিজের userId নামে room এ join করবে
        socket.join(userId);
      }

      socket.on("disconnect", () => {
        console.log("User disconnected:", userId);
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
