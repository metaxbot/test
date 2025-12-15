module.exports = {
  name: "ping",
  run: ({ api, event }) => {
    api.sendMessage("🏓 Pong!", event.threadID);
  }
};
