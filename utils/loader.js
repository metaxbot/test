const fs = require("fs");
const path = require("path");

function loadCommands() {
  const commands = new Map();
  const files = fs.readdirSync("./commands");
  for (const file of files) {
    const cmd = require(`../commands/${file}`);
    commands.set(cmd.name, cmd);
  }
  return commands;
}

function loadEvents() {
  const events = {};
  const files = fs.readdirSync("./events");
  for (const file of files) {
    const evt = require(`../events/${file}`);
    events[evt.type] = evt.run;
  }
  return events;
}

module.exports = { loadCommands, loadEvents };
