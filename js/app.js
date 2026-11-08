var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var $ = function(id){ return document.getElementById(id); };
var lsGet = function(k){ try { return localStorage.getItem(k); } catch(e){ return null; } };
var mem = { lang: lsGet("lang") || "en", user: null };
var t = function(k){ return L[mem.lang][k]; };
var nf = function(n, d){ return new Intl.NumberFormat(mem.lang === "ar" ? "ar-u-nu-latn" : "en-US", { maximumFractionDigits: d == null ? 2 : d }).format(n); };
var esc = function(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); };
var mode = "reg", lastTrack = null;

function money(v, cur){ return cur === "USD" ? nf(v, 2) + " USD" : nf(v, 0) + " " + (mem.lang === "ar" ? "ل.س" : "SYP"); }
function payUsdt(usd){
  var fee = usd > 0 ? Math.max(FEE_MIN, usd * FEE_PCT) : 0, net = Math.max(0, usd - fee);
  return Math.ceil((net * (1 + SHAM_FEE) + fee) / CASHOUT);
}
function calc(usd, cur){
  usd = parseFloat(usd) || 0;
  var fee = usd > 0 ? Math.max(FEE_MIN, usd * FEE_PCT) : 0, net = Math.max(0, usd - fee);
  return { usd: usd, fee: fee, net: net, pay: payUsdt(usd), out: cur === "USD" ? net : net * RATE_SYP };
}
function renderCalc(amt, cur, el){
  var c = calc(amt, cur), r = cur === "USD" ? "" : "1 USD = " + nf(RATE_SYP, 0) + " " + (mem.lang === "ar" ? "ل.س" : "SYP");
  el.innerHTML = (cur === "USD" ? "" : '<div><span>' + t("rate") + '</span><span>' + r + '</span></div>') +
    '<div><span>' + t("fee") + '</span><span>' + nf(c.fee) + ' USD</span></div>' +
    '<div><span>' + t("afterFee") + '</span><span>' + nf(c.net) + ' USD</span></div>' +
    '<div><span>' + t("youPay") + '</span><span>' + nf(c.pay, 0) + ' USDT</span></div>' +
    '<div class="tot"><span>' + t("gets") + '</span><span>' + money(c.out, cur) + '</span></div>';
}
function show(id){
  document.querySelectorAll("section").forEach(function(s){ s.classList.toggle("on", s.id === id); });
  document.querySelectorAll("nav button").forEach(function(b){ b.setAttribute("aria-selected", b.dataset.t === id); });
  renderList();
}
document.querySelectorAll("nav button").forEach(function(b){ b.onclick = function(){ show(b.dataset.t); }; });
document.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = function(){ show(b.dataset.go); }; });

function applyLang(){
  var d = document.documentElement; d.lang = mem.lang; d.dir = t("dir");
  document.querySelectorAll("[data-i]").forEach(function(e){ e.textContent = t(e.dataset.i); });
  $("lang").textContent = t("toggle");
  $("a-title").textContent = t(mode === "reg" ? "reg" : "login");
  $("a-go").textContent = t(mode === "reg" ? "reg" : "login");
  $("a-q").textContent = t(mode === "reg" ? "haveAcc" : "noAcc");
  $("a-sw").textContent = t(mode === "reg" ? "toLogin" : "toReg");
  document.title = "3bod";
  $("c-amt").oninput(); $("s-amt").oninput();
  refreshAuth();
  if (lastTrack) track(lastTrack);
  $("s-msg").innerHTML = ""; $("a-msg").innerHTML = "";
}
$("lang").onclick = function(){
  mem.lang = mem.lang === "en" ? "ar" : "en";
  try { localStorage.setItem("lang", mem.lang); } catch(e){}
  applyLang();
};

async function refreshAuth(){
  var s = (await sb.auth.getSession()).data.session, u = s ? s.user : null;
  mem.user = u;
  var name = u ? ((u.user_metadata && u.user_metadata.name) || u.email) : "";
  $("who").textContent = name;
  $("a-in").hidden = !!u; $("a-out").hidden = !u;
  $("s-form").hidden = !u; $("s-needs").hidden = !!u;
  $("s-sub").textContent = t(u ? "sSubIn" : "sSubOut");
  if (u) $("a-hi").textContent = name;
  renderList();
}
sb.auth.onAuthStateChange(function(){ setTimeout(refreshAuth, 0); });

$("a-sw").onclick = function(){
  mode = mode === "reg" ? "login" : "reg";
  $("a-nameBox").hidden = mode !== "reg";
  $("a-msg").innerHTML = ""; applyLang();
};
$("a-go").onclick = async function(){
  var mail = $("a-mail").value.trim().toLowerCase(), pass = $("a-pass").value, name = $("a-name").value.trim();
  var err = function(m){ $("a-msg").innerHTML = '<div class="msg err">' + esc(m) + '</div>'; };
  if (!mail || !pass) return err(t("errAuth"));
  var r;
  if (mode === "reg") {
    if (!name) return err(t("errName"));
    r = await sb.auth.signUp({ email: mail, password: pass, options: { data: { name: name } } });
    if (r.error) return err(r.error.message);
    if (!r.data.session) return err("Email confirmation is ON in Supabase. Turn it off (Authentication > Providers > Email).");
  } else {
    r = await sb.auth.signInWithPassword({ email: mail, password: pass });
    if (r.error) return err(t("errBad"));
  }
  $("a-msg").innerHTML = ""; refreshAuth();
};
$("a-exit").onclick = async function(){ await sb.auth.signOut(); show("calc"); };

$("c-amt").oninput = $("c-cur").onchange = function(){ renderCalc($("c-amt").value, $("c-cur").value, $("c-out")); };
$("s-amt").oninput = $("s-cur").onchange = function(){ renderCalc($("s-amt").value, $("s-cur").value, $("s-out")); };
["s-phone", "s-sham"].forEach(function(id){
  $(id).addEventListener("input", function(){ var v = this.value.replace(/[^0-9]/g, ""); if (v !== this.value) this.value = v; });
});

function newCode(){
  var a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
  for (var i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return "3BD-" + s;
}
function payBox(o){
  return '<div class="pay"><div class="pay-h"><b>' + t("payH") + '</b><span class="tag">' + esc(PAY.network) + '</span></div>' +
    '<div class="pay-amt"><span>' + t("payAmt") + '</span><b>' + nf(Number(o.usdt), 0) + ' USDT</b></div>' +
    '<div class="pay-body"><div class="qr"></div><div class="pay-addr"><span class="sub" style="margin:0">' + t("payAddr") + '</span><span class="code addr">' + esc(PAY.address) + '</span><button class="pill p-copy">' + t("copy") + '</button></div></div>' +
    '<p class="note">' + t("payWarn") + '</p><p class="sub" style="margin:6px 0 0">' + t("payNext") + '</p></div>';
}
function wirePay(){
  document.querySelectorAll(".pay").forEach(function(p){
    var b = p.querySelector(".p-copy"), q = p.querySelector(".qr");
    if (b) b.onclick = function(){ try { navigator.clipboard.writeText(PAY.address); b.textContent = t("copied"); } catch(e){} };
    if (q && !q.firstChild && window.QRCode) { try { new QRCode(q, { text: PAY.address, width: 132, height: 132 }); } catch(e){} }
  });
}
function compress(f, cb){
  var r = new FileReader();
  r.onload = function(){
    var im = new Image();
    im.onload = function(){
      var s = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(cb, "image/jpeg", 0.7);
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
}

$("s-go").onclick = async function(){
  var name = $("s-name").value.trim(), phone = $("s-phone").value.trim(), sham = $("s-sham").value.trim(),
      amt = parseFloat($("s-amt").value), cur = $("s-cur").value;
  if (!name || phone.length < 8 || !sham || !(amt >= 1)) { $("s-msg").innerHTML = '<div class="msg err">' + t("errSend") + '</div>'; return; }
  var c = calc(amt, cur), code = newCode(), btn = $("s-go");
  btn.disabled = true;
  var r = await sb.from("orders").insert({ code: code, user_id: mem.user.id, recipient_name: name, recipient_phone: phone, sham_account: sham,
    amount_usd: amt, receive_cur: cur, payout: c.out, usdt_amount: c.pay });
  btn.disabled = false;
  if (r.error) { $("s-msg").innerHTML = '<div class="msg err">' + esc(r.error.message) + '</div>'; return; }
  $("s-msg").innerHTML = '<div class="msg">' + t("created") + ' <span class="code">' + code + '</span></div>' + payBox({ usdt: c.pay });
  wirePay();
  $("s-name").value = ""; $("s-phone").value = ""; $("s-sham").value = "";
  renderList();
};

function renderOrder(o){
  lastTrack = o.code;
  var h = '<div class="msg"><b></b> <span class="tag">Sham Cash</span><br>' + nf(Number(o.amount_usd)) + ' USD → ' + money(Number(o.payout), o.receive_cur) +
    '<br><span class="code">' + esc(o.code) + '</span></div><ul class="steps">';
  t("stages").forEach(function(s, i){ h += '<li class="' + (i <= o.stage ? "done" : "") + '">' + s + '</li>'; });
  h += '</ul>';
  if (o.stage === 0 && o.paid) h += '<div class="msg">' + t("paidDone") + '</div>';
  else if (o.stage === 0 && o.is_mine)
    h += '<label for="t-tx">' + t("lTx") + '</label><input id="t-tx" class="ltr" autocomplete="off">' +
      '<label for="t-shot">' + t("lShot") + '</label><input id="t-shot" type="file" accept="image/*">' +
      '<img id="t-prev" alt="" hidden style="max-width:100%;max-height:220px;margin-top:8px;border-radius:8px"><div id="t-err"></div>' +
      '<button class="btn" id="t-paid">' + t("paidBtn") + '</button>' + payBox({ usdt: o.usdt_amount });
  $("t-res").innerHTML = h;
  $("t-res").querySelector("b").textContent = o.recipient_name;
  wirePay();
  var sh = $("t-shot"), shot = null;
  if (sh) sh.onchange = function(){
    var f = sh.files[0]; if (!f) return;
    compress(f, function(b){ shot = b; var p = $("t-prev"); p.src = URL.createObjectURL(b); p.hidden = false; $("t-err").innerHTML = ""; });
  };
  var pb = $("t-paid");
  if (pb) pb.onclick = async function(){
    if (!shot) { $("t-err").innerHTML = '<div class="msg err">' + t("errShot") + '</div>'; return; }
    pb.disabled = true;
    var path = mem.user.id + "/" + o.code + "-" + Date.now() + ".jpg";
    var u = await sb.storage.from("proofs").upload(path, shot, { contentType: "image/jpeg" });
    if (u.error) { pb.disabled = false; $("t-err").innerHTML = '<div class="msg err">' + esc(u.error.message) + '</div>'; return; }
    var r = await sb.rpc("submit_payment", { p_code: o.code, p_txid: $("t-tx").value.trim(), p_path: path });
    if (r.error) { pb.disabled = false; $("t-err").innerHTML = '<div class="msg err">' + esc(r.error.message) + '</div>'; return; }
    track(o.code);
  };
}
async function track(code){
  code = (code || "").trim().toUpperCase();
  var r = await sb.rpc("track_order", { p_code: code }), o = r.data && r.data[0];
  if (!o) { lastTrack = null; $("t-res").innerHTML = '<div class="msg err">' + t("errCode") + '</div>'; return; }
  $("t-code").value = code; renderOrder(o);
}
$("t-go").onclick = function(){ track($("t-code").value); };
async function renderList(){
  var el = $("t-list");
  if (!mem.user) { el.innerHTML = ""; return; }
  var r = await sb.from("orders").select("code,recipient_name,amount_usd,stage").eq("user_id", mem.user.id).order("created_at", { ascending: false });
  var rows = r.data || [];
  el.innerHTML = rows.length ? "<b>" + t("mine") + "</b>" : "";
  rows.forEach(function(o){
    var b = document.createElement("button"), a = document.createElement("span"), s = document.createElement("span");
    a.textContent = o.recipient_name + " – " + nf(Number(o.amount_usd)) + " USD"; s.textContent = t("stages")[o.stage];
    b.appendChild(a); b.appendChild(s); b.onclick = function(){ track(o.code); }; el.appendChild(b);
  });
}
applyLang();
