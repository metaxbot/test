module.exports = {
  name: "info",
  run: ({ api, event, stats }) => {
    api.sendMessage(
      `🤖 Bot Info\nMessages: ${stats.totalMessages}`,
      event.threadID
    );
  }
};
