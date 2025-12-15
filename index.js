const login = require("@dongdev/fca-unofficial");
const fs = require("fs");
const path = require("path");
const express = require("express");

const config = require("./config.json");
const { connectDB, stats, saveStatsDebounced } = require("./utils/database");
const { loadCommands, loadEvents } = require("./utils/loader");

const app = express();
const startTime = Date.now();

/* =======================
   DASHBOARD (EXPRESS)
======================= */
app.use(express.static("dashboard"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🌐 Dashboard running on port ${PORT}`)
);

/* =======================
   PERMISSION SYSTEM
======================= */
async function hasPermission(api, event, level) {
  const uid = event.senderID;

  const isBotAdmin = config.admins.includes(uid);
  const isModerator = config.moderators.includes(uid);

  // 5 → Bot Admin only
  if (level === 5) return isBotAdmin;

  // 4 → Bot Admin + Moderator
  if (level === 4) return isBotAdmin || isModerator;

  // Group admin check
  let isGroupAdmin = false;
  if (event.isGroup) {
    try {
      const info = await api.getThreadInfo(event.threadID);
      isGroupAdmin = info.adminIDs.some(a => a.id === uid);
    } catch {}
  }

  // 3 → Bot Admin + Group Admin
  if (level === 3) return isBotAdmin || isGroupAdmin;

  // 2 → Bot Admin + Moderator + Group Admin
  if (level === 2)
    return isBotAdmin || isModerator || isGroupAdmin;

  // 1 → All users
  return true;
}

/* =======================
   MAIN BOT
======================= */
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

    // Auto add owner as admin
    if (!config.admins.includes(botUID)) {
      config.admins.push(botUID);
      fs.writeFileSync(
        "config.json",
        JSON.stringify(config, null, 2)
      );
      console.log("✅ Bot owner auto-added as admin");
    }

    console.log("🤖 Bot logged in as:", botUID);

    api.listenMqtt(async (err, event) => {
      if (err) return console.error(err);

      // Ignore own messages
      if (event.senderID === botUID) return;

      /* ========= EVENTS ========= */
      if (events[event.type]) {
        events[event.type](api, event);
      }

      if (event.type !== "message" || !event.body) return;

      stats.totalMessages++;
      saveStatsDebounced();

      const prefix = config.prefix;
      const body = event.body.trim();

      // Prefix check
      if (!body.startsWith(prefix)) {
        if (config.autoReply) {
          api.sendMessage(
            `🤖 ${config.botName}\nUse prefix "${prefix}" to run commands`,
            event.threadID
          );
        }
        return;
      }

      const args = body.slice(prefix.length).trim().split(/\s+/);
      const cmdName = args.shift().toLowerCase();

      const command = commands.get(cmdName);
      if (!command) return;

      // Prefix false command support
      if (command.prefix === false && body.startsWith(prefix)) return;

      // Permission check
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

      /* ========= RUN COMMAND ========= */
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
        console.error(`❌ Error in command ${command.name}`, e);
        api.sendMessage(
          "⚠️ Command execution error",
          event.threadID
        );
      }
    });
  });
})();
