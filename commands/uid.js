module.exports = {
  name: "uid",

  run: async ({ api, event }) => {
    let targetID = event.senderID;

    // যদি রিপ্লাই করা হয়
    if (event.messageReply) {
      targetID = event.messageReply.senderID;
    }

    // যদি mention থাকে
    const mentions = event.mentions || {};
    const mentionIDs = Object.keys(mentions);
    if (mentionIDs.length > 0) {
      targetID = mentionIDs[0];
    }

    const msg = `
🆔 Facebook UID

UID: ${targetID}
    `.trim();

    api.sendMessage(msg, event.threadID);
  }
};
