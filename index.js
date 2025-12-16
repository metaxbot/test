// =======================
// MODULES
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
// DASHBOARD
// =======================
app.use(express.static("dashboard"));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌐 Dashboard running on port", PORT);
});

// =======================
// PERMISSION SYSTEM (1–5)
// =======================
async function hasPermission(api, event, level) {
  const uid = event.senderID;

  const isBotAdmin = config.admins.includes(uid);
  const isModerator = config.moderators.includes(uid);

  if (level === 5) return isBotAdmin;
  if (level === 4) return isBotAdmin || isModerator;

  let isGroupAdmin = false;
  if (event.isGroup) {
    try {
      const info = await api.getThreadInfo(event.threadID);
      isGroupAdmin = info.adminIDs.some(a => a.id === uid);
    } catch {}
  }

  if (level === 3) return isBotAdmin || isGroupAdmin;
  if (level === 2) return isBotAdmin || isModerator || isGroupAdmin;

  return true; // level 1
}

// =======================
// MAIN
// =======================
(async () => {
  await connectDB();

  const commands = loadCommands();
  const events = loadEvents();

  const appState = JSON.parse(
    fs.readFileSync("appstate.json", "utf8")
  );

  login({ appState }, (err, api) => {
    if (err) {
      console.error("❌ FCA Login Failed", err);
      process.exit(1);
    }

    api.setOptions({
      selfListen: false,
      listenEvents: true
    });

    const botUID = api.getCurrentUserID();

    // auto add owner
    if (!config.admins.includes(botUID)) {
      config.admins.push(botUID);
      fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
      console.log("✅ Owner added as admin");
    }

    console.log("🤖 Logged in as:", botUID);

    // =======================
    // LISTENER
    // =======================
    api.listenMqtt(async (err, event) => {
      if (err) return console.error(err);

      // ignore self
      if (event.senderID === botUID) return;

      // events
      if (events[event.type]) {
        events[event.type](api, event);
      }

      if (event.type !== "message" || !event.body) return;

      // stats
      stats.totalMessages++;
      saveStatsDebounced();

      const prefix = config.prefix;
      const raw = event.body.trim();

      let usedPrefix = false;
      let text = raw;

      // =======================
      // PREFIX DETECTION (FINAL)
      // =======================
      if (raw.startsWith(prefix)) {
        usedPrefix = true;
        text = raw.slice(prefix.length).trim();
      }

      if (!text) return;

      // =======================
      // COMMAND PARSE
      // =======================
      const parts = text.split(/\s+/);
      const cmdName = parts.shift().toLowerCase();
      const args = parts;

      const command = commands.get(cmdName);
      if (!command) return;

      // =======================
      // PREFIX RULE (100% FIXED)
      // =======================
      if (command.prefix === true && !usedPrefix) return;
      if (command.prefix === false && usedPrefix) return;

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
          "❌ You don't have permission",
          event.threadID
        );
      }

      // =======================
      // RUN COMMAND
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
        console.error("❌ Command error:", e);
        api.sendMessage(
          "⚠️ Command execution failed",
          event.threadID
        );
      }
    });
  });
})();
