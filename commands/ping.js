module.exports = {
  name: "ping",
  altnames: ["p"],
  version: "1.0",
  permission: 1,
  prefix: false,
  author: "Adi.0X",
  description: "Check bot response",
  dependence: [],

  async run({ api, event }) {
    api.sendMessage("🏓 Pong!", event.threadID);
  }
};
