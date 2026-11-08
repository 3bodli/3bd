var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var $ = function(id){ return document.getElementById(id); };
var ST = ["بانتظار الدفع", "تم استلام الدفعة", "قيد المعالجة", "أُرسلت إلى شام كاش", "تم التسليم"];
var all = [];
function el(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function view(ok, msg){ $("login").hidden = ok; $("panel").hidden = !ok; $("login").classList.toggle("on", !ok); $("panel").classList.toggle("on", ok); $("l-msg").textContent = msg || ""; }
async function boot(){
  var s = (await sb.auth.getSession()).data.session;
  if (!s) return view(false);
  var p = await sb.from("profiles").select("is_admin").eq("id", s.user.id).single();
  if (!p.data || !p.data.is_admin) { await sb.auth.signOut(); return view(false, "هذا الحساب ليس أدمن."); }
  view(true); load();
}
$("l-go").onclick = async function(){
  var r = await sb.auth.signInWithPassword({ email: $("l-mail").value.trim(), password: $("l-pass").value });
  if (r.error) { $("l-msg").textContent = "البريد أو كلمة المرور غير صحيحة."; return; }
  boot();
};
$("out").onclick = async function(){ await sb.auth.signOut(); view(false); };
async function load(){
  var r = await sb.from("orders").select("*").order("created_at", { ascending: false });
  if (r.error) { $("list").textContent = r.error.message; return; }
  all = r.data; draw();
}
$("flt").onchange = draw; $("rf").onclick = load;
function draw(){
  var f = $("flt").value, box = $("list"); box.innerHTML = "";
  var rows = all.filter(function(o){
    if (f === "all") return true;
    if (f === "verify") return o.stage === 0 && o.paid;
    if (f === "wait") return o.stage === 0 && !o.paid;
    return o.stage === +f;
  });
  if (!rows.length) { box.appendChild(el("p", "sub", "لا توجد حوالات.")); return; }
  rows.forEach(function(o){
    var c = el("div", "card"), h = el("div", "r");
    h.appendChild(el("b", "code", o.code)); h.appendChild(el("span", "tag", ST[o.stage])); c.appendChild(h);
    [["الاسم", o.recipient_name], ["الهاتف", o.recipient_phone], ["شام كاش", o.sham_account],
     ["المبلغ", o.amount_usd + " USD"], ["المطلوب استلامه (USDT)", o.usdt_amount],
     ["يستلم المستفيد", o.payout + " " + o.receive_cur], ["TXID", o.txid || "—"],
     ["التاريخ", new Date(o.created_at).toLocaleString("ar-u-nu-latn")]].forEach(function(x){
      var r = el("div", "r"); r.appendChild(el("span", null, x[0])); r.appendChild(el("span", null, String(x[1]))); c.appendChild(r);
    });
    var a = el("div", "acts");
    if (o.shot_path) {
      var v = el("button", "pill", "عرض اللقطة");
      v.onclick = async function(){
        var w = window.open("", "_blank"), r = await sb.storage.from("proofs").createSignedUrl(o.shot_path, 300);
        if (r.data) w.location = r.data.signedUrl; else { w.close(); alert(r.error.message); }
      };
      a.appendChild(v);
    }
    var sel = el("select");
    ST.forEach(function(s, i){ var op = el("option", null, s); op.value = i; if (i === o.stage) op.selected = true; sel.appendChild(op); });
    var sv = el("button", "btn", "حفظ الحالة");
    sv.onclick = async function(){
      var r = await sb.from("orders").update({ stage: +sel.value }).eq("code", o.code);
      if (r.error) { alert(r.error.message); return; }
      load();
    };
    a.appendChild(sel); a.appendChild(sv); c.appendChild(a); box.appendChild(c);
  });
}
boot();
