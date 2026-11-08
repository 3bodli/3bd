// ===== Supabase (Project Settings > API) =====
var SUPABASE_URL = "https://riyqscmcrupswyxeelsa.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_CgW_z8fcu3GTiO6zpXtHuA_eW8v22_S";

// ===== Rates, fees, wallet =====
var RATE_SYP = 12400;  // SYP per 1 USD (demo number)
var FEE_PCT = 0.02;   // 2% fee
var FEE_MIN = 2;       // minimum fee in USD
var CASHOUT = 196/205;     // USD you actually get for each 1 USDT
var SHAM_FEE = 0;      // Sham Cash fee on payout (0.01 = 1%), set your real value
var PAY = {network:"TRC20 (Tron)", address:"TBJkux3DdkRKVyJjUALfg6nGUR1wggeXFp"}; // your Binance deposit address
