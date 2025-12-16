const fs = require("fs");
const path = require("path");

const LANG = "en"; // future: per-user / per-group
const data = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "languages", `${LANG}.json`),
    "utf8"
  )
);

function t(key, vars = {}) {
  let text = data[key] || key;
  for (const k in vars) {
    text = text.replaceAll(`{${k}}`, vars[k]);
  }
  return text;
}

module.exports = { t };
