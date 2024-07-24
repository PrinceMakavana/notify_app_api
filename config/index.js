
let config = {
  app_code: "mahjong-api",
  db: `${process.env.MONGODB_URL}${process.env.DATABASE_NAME}`,
  dbName: process.env.DATABASE_NAME,
  baseURL:  'http://localhost:3034/',
  portalBaseURL: 'http://localhost:5173/',
  speechToTextAlternativeLanguages: {
    'en': ['en-AU', 'en-CA', 'en-GB', 'en-GH', 'en-HK', 'en-IE', 'en-IN', 'en-KE', 'en-NG', 'en-NZ', 'en-PH', 'en-SG', 'en-TZ', 'en-US', 'en-ZA'],
    'cn': ['wuu-CN', 'yue-CN', 'zh-CN', 'zh-CN-shandong', 'zh-CN-sichuan'],
    'zh': ['zh-CN', 'zh-CN-shandong', 'zh-CN-sichuan', 'zh-HK', 'zh-TW']
  },
  speechToTextLanguages:{
    'en': 'en-US',
    'cn': 'yue-CN',
    'zh': 'zh-CN'
  }
};

if (process.env.NODE_ENV && process.env.NODE_ENV == 'staging') {
  config.baseURL = 'https://notify-app-api.onrender.com/'
  config.portalBaseURL  = 'https://frabjous-sawine-326eea.netlify.app/'
  console.log('call condition');
  console.log('config ', config);
  console.log('process.env ', process.env);
} else if (process.env.NODE_ENV && process.env.NODE_ENV == 'production') {
  config.baseURL = 'https://notify-app-api.onrender.com/'
  config.portalBaseURL  = 'https://frabjous-sawine-326eea.netlify.app/'
}


module.exports = config;
