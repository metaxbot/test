process.env.FCA_NO_UPDATE = "1";

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
const { t } = require("./utils/lang");

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
// PERMISSION SYSTEM
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

  return true;
}

// =======================
// COMMAND SUGGESTION
// =======================
function getSuggestion(input, commands) {
  let best = null;
  let min = Infinity;

  for (const name of commands.keys()) {
    const dist = levenshtein(input, name);
    if (dist < min) {
      min = dist;
      best = name;
    }
  }

  return min <= 2 ? best : null;
}

function levenshtein(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] =
        b[i - 1] === a[j - 1]
          ? m[i - 1][j - 1]
          : Math.min(
              m[i - 1][j - 1] + 1,
              m[i][j - 1] + 1,
              m[i - 1][j] + 1
            );
    }
  }
  return m[b.length][a.length];
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

    if (!config.admins.includes(botUID)) {
      config.admins.push(botUID);
      fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
    }

    console.log("🤖 Logged in as:", botUID);

    // =======================
    // LISTENER
    // =======================
    api.listenMqtt(async (err, event) => {
      if (err) return console.error(err);

      if (event.senderID === botUID) return;

      if (events[event.type]) {
        events[event.type](api, event);
      }

      if (event.type !== "message" || !event.body) return;

      stats.totalMessages++;
      saveStatsDebounced();

      const prefix = config.prefix;
      const raw = event.body.trim();

      let usedPrefix = false;
      let text = raw;

      // =======================
      // PREFIX DETECTION
      // =======================
      if (raw.startsWith(prefix)) {
        usedPrefix = true;
        text = raw.slice(prefix.length).trim();
      }

      // =======================
      // ONLY PREFIX USED ✅
      // =======================
      if (usedPrefix && text.length === 0) {
        return api.sendMessage(
          t("ONLY_PREFIX", { prefix }),
          event.threadID
        );
      }

      // =======================
      // IGNORE EMPTY
      // =======================
      if (!text) return;

      // =======================
      // PARSE COMMAND
      // =======================
      const parts = text.split(/\s+/);
      const cmdName = parts.shift().toLowerCase();
      const args = parts;

      const command = commands.get(cmdName);

      // =======================
      // COMMAND NOT FOUND
      // =======================
      if (!command) {
        if (!usedPrefix) return;

        const suggestion = getSuggestion(cmdName, commands);
        return api.sendMessage(
          t("COMMAND_NOT_FOUND", {
            suggest: suggestion
              ? `\n💡 Did you mean ${prefix}${suggestion} ?`
              : ""
          }),
          event.threadID
        );
      }

      // =======================
      // PREFIX RULE
      // =======================
      if (command.prefix === true && !usedPrefix) return;
      if (command.prefix === false && usedPrefix) return;

      // =======================
      // PERMISSION
      // =======================
      const allowed = await hasPermission(
        api,
        event,
        command.permission || 1
      );

      if (!allowed) {
        return api.sendMessage(
          t("NO_PERMISSION"),
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
        console.error(e);
        api.sendMessage(
          "⚠️ Command execution error",
          event.threadID
        );
      }
    });
  });
})();
