const login = require("@dongdev/fca-unofficial");
const fs = require("fs");
const express = require("express");
const path = require("path");
const config = require("./config.json");
const { connectDB, stats, saveStatsDebounced } = require("./utils/database");
const { loadCommands, loadEvents } = require("./utils/loader");

const app = express();
const startTime = Date.now();

app.use(express.static("dashboard"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🌐 Dashboard running on port", PORT));

(async () => {
  await connectDB();

  const commands = loadCommands();
  const events = loadEvents();

  login(
    { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
    (err, api) => {
      if (err) return console.error(err);

      api.setOptions({ selfListen: false });

      const botUID = api.getCurrentUserID();

      // Auto add first admin
      if (!config.admins.includes(botUID)) {
        config.admins.push(botUID);
        fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
        console.log("✅ Bot owner added as admin");
      }

      api.listenMqtt(async (err, event) => {
        if (err) return;

        if (event.senderID === botUID) return;

        stats.totalMessages++;
        saveStatsDebounced();

        if (events[event.type]) {
          events[event.type](api, event);
        }

        if (event.type !== "message" || !event.body) return;

        const prefix = config.prefix;
        if (!event.body.startsWith(prefix)) {
          if (config.autoReply) {
            api.sendMessage(
              `🤖 ${config.botName}\nকম্যান্ড দিতে "${prefix}" ব্যবহার করো`,
              event.threadID
            );
          }
          return;
        }

        const args = event.body.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();

        const command = commands.get(cmdName);
        if (!command) return;

        if (command.adminOnly && !config.admins.includes(event.senderID)) {
          return api.sendMessage("❌ Admin only command", event.threadID);
        }

        command.run({ api, event, args, startTime, stats });
      });
    }
  );
})();
