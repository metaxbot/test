const fs = require("fs");
const path = require("path");

const REQUIRED_KEYS = [
  "name",
  "author",
  "version",
  "permission",
  "prefix",
  "description",
  "dependence",
  "run"
];

function validateCommand(cmd, fileName) {
  for (const key of REQUIRED_KEYS) {
    if (!(key in cmd)) {
      console.warn(
        `⚠️ Command "${fileName}" skipped → missing "${key}"`
      );
      return false;
    }
  }

  if (typeof cmd.run !== "function") {
    console.warn(
      `⚠️ Command "${fileName}" skipped → run is not a function`
    );
    return false;
  }

  return true;
}

function loadCommands() {
  const commands = new Map();
  const cmdDir = path.join(__dirname, "..", "commands");
  const files = fs.readdirSync(cmdDir).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const cmdPath = path.join(cmdDir, file);
    const cmd = require(cmdPath);

    if (!validateCommand(cmd, file)) continue;

    commands.set(cmd.name.toLowerCase(), cmd);

    if (Array.isArray(cmd.altnames)) {
      for (const alt of cmd.altnames) {
        commands.set(alt.toLowerCase(), cmd);
      }
    }
  }

  console.log(`📦 Loaded ${commands.size} command aliases`);
  return commands;
}

function loadEvents() {
  const events = {};
  const evtDir = path.join(__dirname, "..", "events");
  const files = fs.readdirSync(evtDir).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const evt = require(path.join(evtDir, file));
    if (!evt.type || typeof evt.run !== "function") continue;
    events[evt.type] = evt.run;
  }

  console.log(`📡 Loaded ${Object.keys(events).length} events`);
  return events;
}

module.exports = { loadCommands, loadEvents };
