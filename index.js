// =======================
// REQUIRED MODULES
// =======================
const login = require("@dongdev/fca-unofficial");
const fs = require("fs");
const path = require("path");
const express = require("express");

const config = require("./config.json");
const { connectDB, stats, saveStatsDebounced } = require("./utils/database");
const { loadCommands, loadEvents } = require("./utils/loader");

// =======================
// BASIC SETUP
// =======================
const app = express();
const startTime = Date.now();

// =======================
// DASHBOARD (EXPRESS)
// =======================
app.use(express.static("dashboard"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🌐 Dashboard running on port ${PORT}`)
);

// =======================
// PERMISSION SYSTEM (1–5)
// =======================
async function hasPermission(api, event, level) {
  const uid = event.senderID;

  const isBotAdmin = config.admins.includes(uid);
  const isModerator = config.moderators.includes(uid);

  // notes: level 5 → only bot admins
  if (level === 5) return isBotAdmin;

  // notes: level 4 → bot admins + moderators
  if (level === 4) return isBotAdmin || isModerator;

  // notes: check group admin (facebook group admin)
  let isGroupAdmin = false;
  if (event.isGroup) {
    try {
      const info = await api.getThreadInfo(event.threadID);
      isGroupAdmin = info.adminIDs.some(a => a.id === uid);
    } catch {}
  }

  // notes: level 3 → bot admins + group admins
  if (level === 3) return isBotAdmin || isGroupAdmin;

  // notes: level 2 → bot admins + moderators + group admins
  if (level === 2)
    return isBotAdmin || isModerator || isGroupAdmin;

  // notes: level 1 → all users
  return true;
}

// =======================
// MAIN BOT LOGIC
// =======================
(async () => {
  // notes: connect MongoDB once at startup
  await connectDB();

  // notes: load all commands & events dynamically
  const commands = loadCommands();
  const events = loadEvents();

  // notes: login using appstate.json (no email/password)
  const appState = JSON.parse(
    fs.readFileSync("appstate.json", "utf8")
  );

  login({ appState }, (err, api) => {
    if (err) {
      console.error("❌ FCA Login Failed", err);
      process.exit(1);
    }

    api.setOptions({
      selfListen: false, // notes: ignore own messages
      listenEvents: true
    });

    const botUID = api.getCurrentUserID();

    // =======================
    // AUTO OWNER → ADMIN
    // =======================
    if (!config.admins.includes(botUID)) {
      config.admins.push(botUID);
      fs.writeFileSync(
        "config.json",
        JSON.stringify(config, null, 2)
      );
      console.log("✅ Bot owner auto-added as admin");
    }

    console.log("🤖 Bot logged in as:", botUID);

    // =======================
    // MESSAGE LISTENER
    // =======================
    api.listenMqtt(async (err, event) => {
      if (err) return console.error(err);

      // notes: ignore bot's own messages
      if (event.senderID === botUID) return;

      // =======================
      // EVENTS HANDLER
      // =======================
      if (events[event.type]) {
        events[event.type](api, event);
      }

      // notes: only handle text messages
      if (event.type !== "message" || !event.body) return;

      // =======================
      // DATABASE STATS
      // =======================
      stats.totalMessages++;
      saveStatsDebounced();

      const body = event.body.trim();
      const prefix = config.prefix;

      let cmdName;
      let args = [];
      let usedPrefix = false;

      // =======================
      // PREFIX PARSER (CORE FIX)
      // =======================

      // notes: CASE 1 → prefix used
      if (body.startsWith(prefix)) {
        usedPrefix = true;

        const withoutPrefix = body
          .slice(prefix.length)
          .trim();

        if (!withoutPrefix) return;

        const parts = withoutPrefix.split(/\s+/);
        cmdName = parts.shift().toLowerCase();
        args = parts;
      }

      // notes: CASE 2 → no prefix
      else {
        const parts = body.split(/\s+/);
        cmdName = parts.shift().toLowerCase();
        args = parts;
      }

      // notes: find command (supports altnames)
      const command = commands.get(cmdName);
      if (!command) return;

      // =======================
      // PREFIX RULE CHECK
      // =======================

      // notes: prefix:true command but user didn't use prefix
      if (command.prefix !== false && !usedPrefix) {
        return;
      }

      // notes: prefix:false command but user used prefix
      if (command.prefix === false && usedPrefix) {
        return;
      }

      // =======================
      // PERMISSION CHECK
      // =======================
      const allowed = await hasPermission(
        api,
        event,
        command.permission || 1
      );

      if (!allowed) {
        return api.sendMessage(
          "❌ You don't have permission to use this command",
          event.threadID
        );
      }

      // =======================
      // RUN COMMAND SAFELY
      // =======================
      try {
        await command.run({
          api,
          event,
          args,
          config,
          startTime,
          stats
        });
      } catch (e) {
        console.error(
          `❌ Error in command ${command.name}`,
          e
        );
        api.sendMessage(
          "⚠️ Command execution error",
          event.threadID
        );
      }
    });
  });
})();
