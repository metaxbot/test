const mongoose = require("mongoose");
const config = require("../config.json");

const StatsSchema = new mongoose.Schema({
  totalUsers: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 }
});

const Stats = mongoose.model("Stats", StatsSchema);

let stats = {
  totalUsers: 0,
  totalMessages: 0
};

let saveTimeout = null;

async function connectDB() {
  const uri = process.env.MONGO_URI || config.mongoURI;

  if (!uri) {
    console.error("❌ MongoDB URI missing!");
    process.exit(1);
  }

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  let data = await Stats.findOne();
  if (!data) data = await Stats.create(stats);

  stats = data;
  console.log("🗄 MongoDB Connected");
}

function saveStatsDebounced() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await Stats.updateOne({}, {
      totalUsers: stats.totalUsers,
      totalMessages: stats.totalMessages
    });
  }, 5000);
}

module.exports = {
  connectDB,
  stats,
  saveStatsDebounced
};
