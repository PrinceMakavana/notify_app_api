
let config = {
  app_code: "mahjong-api",
  db: `${process.env.MONGODB_URL}${process.env.DATABASE_NAME}`,
  dbName: process.env.DATABASE_NAME,
};

if (process.env.NODE_ENV && process.env.NODE_ENV == "staging") {
} else if (process.env.NODE_ENV && process.env.NODE_ENV == "production") {
}


module.exports = config;
