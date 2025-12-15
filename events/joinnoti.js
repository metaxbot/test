module.exports = {
  type: "event",
  run: (api, event) => {
    if (event.logMessageType === "log:subscribe") {
      api.sendMessage("👋 Welcome!", event.threadID);
    }
  }
};
