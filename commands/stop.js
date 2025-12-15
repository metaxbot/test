module.exports = {
  name: "stop",
  adminOnly: true,
  run: ({ api, event }) => {
    api.sendMessage("🛑 Bot shutting down", event.threadID);
    process.exit(0);
  }
};
