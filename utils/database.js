const mongoose = require("mongoose");

const StatsSchema = new mongoose.Schema({
  totalUsers: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 }
});

const Stats = mongoose.model("Stats", StatsSchema);

let stats = { totalUsers: 0, totalMessages: 0 };
let saveTimeout = null;

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  let data = await Stats.findOne();
  if (!data) data = await Stats.create(stats);
  stats = data;
  console.log("🗄 MongoDB Connected");
}

function saveStatsDebounced() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    Stats.updateOne({}, stats).exec();
  }, 5000);
}

module.exports = { connectDB, stats, saveStatsDebounced };
