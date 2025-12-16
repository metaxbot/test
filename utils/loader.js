const fs = require("fs");
const path = require("path");

/**
 * Load commands with altnames support
 */
function loadCommands() {
  const commands = new Map();
  const cmdPath = path.join(__dirname, "..", "commands");

  const files = fs.readdirSync(cmdPath).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const cmd = require(path.join(cmdPath, file));

    if (!cmd.name) continue;

    // main name
    commands.set(cmd.name.toLowerCase(), cmd);

    // altnames support
    if (Array.isArray(cmd.altnames)) {
      for (const alt of cmd.altnames) {
        commands.set(alt.toLowerCase(), cmd);
      }
    }
  }

  console.log(`📦 Loaded ${commands.size} command aliases`);
  return commands;
}

/**
 * Load events
 */
function loadEvents() {
  const events = {};
  const evtPath = path.join(__dirname, "..", "events");

  const files = fs.readdirSync(evtPath).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const evt = require(path.join(evtPath, file));
    if (!evt.type || typeof evt.run !== "function") continue;

    events[evt.type] = evt.run;
  }

  console.log(`📡 Loaded ${Object.keys(events).length} events`);
  return events;
}

module.exports = { loadCommands, loadEvents };
