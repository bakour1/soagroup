// assets\js\auth.js
(function () {
  const cfg = window.SOA_CONFIG;
  const KEY = "soa_session_v1";
  function sha1(s) {
    function rhex(n) {
      var s = "",
        j = 0;
      for (; j < 4; j++)
        s += ("0" + ((n >> (j * 8 + 4)) & 0x0f).toString(16)).slice(-2);
      return s;
    }
    function str2blks_SHA1(s) {
      var nblk = ((s.length + 8) >> 6) + 1,
        blks = new Array(nblk * 16);
      for (var i = 0; i < nblk * 16; i++) blks[i] = 0;
      for (var i = 0; i < s.length; i++)
        blks[i >> 2] |= s.charCodeAt(i) << (24 - (i % 4) * 8);
      blks[i >> 2] |= 0x80 << (24 - (i % 4) * 8);
      blks[nblk * 16 - 1] = s.length * 8;
      return blks;
    }
    var x = str2blks_SHA1(s),
      w = new Array(80),
      a = 1732584193,
      b = -271733879,
      c = -1732584194,
      d = 271733878,
      e = -1009589776;
    for (var i = 0; i < x.length; i += 16) {
      var olda = a,
        oldb = b,
        oldc = c,
        oldd = d,
        olde = e;
      for (var j = 0; j < 80; j++) {
        w[j] =
          j < 16
            ? x[i + j]
            : ((w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]) << 1) |
              ((w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]) >>> 31);
        var t =
          ((a << 5) | (a >>> 27)) +
          e +
          w[j] +
          (j < 20
            ? ((b & c) | (~b & d)) + 1518500249
            : j < 40
            ? (b ^ c ^ d) + 1859775393
            : j < 60
            ? ((b & c) | (b & d) | (c & d)) - 1894007588
            : (b ^ c ^ d) - 899497514);
        e = d;
        d = c;
        c = (b << 30) | (b >>> 2);
        b = a;
        a = t;
      }
      a += olda;
      b += oldb;
      c += oldc;
      d += oldd;
      e += olde;
    }
    return [a, b, c, d, e].map(rhex).join("");
  }
  function saveSession(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }
  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {
      return null;
    }
  }
  function clearSession() {
    localStorage.removeItem(KEY);
  }
  function login(username, password) {
    const normalizedUser = (username || "").trim();
    if (!password) return { ok: false, error: "الرجاء إدخال كلمة السر" };
    const passOk = password === cfg.SHARED_PASSWORD;
    if (!passOk) return { ok: false, error: "كلمة السر غير صحيحة" };
    let role = null;
    if (normalizedUser === cfg.ADMIN_USERNAME) role = "admin";
    else if (normalizedUser === cfg.MEMBER_USERNAME) role = "member";
    else return { ok: false, error: "اسم مستخدم غير مسموح" };
    const token = sha1(normalizedUser + "|" + password + "|" + Date.now());
    const session = { user: normalizedUser, role, token, at: Date.now() };
    saveSession(session);
    return { ok: true, session };
  }
  function logout() {
    clearSession();
    location.href = "login.html";
  }
  window.SOA_AUTH = { login, logout, readSession, clearSession };
})();
