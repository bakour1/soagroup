// assets/js/auth.js
(function () {
  const cfg = window.SOA_CONFIG;
  const KEY = "soa_session_v1";

  // --- إزالة أي جلسة قديمة محفوظة في localStorage (ترقية/تنظيف) ---
  try {
    if (localStorage.getItem(KEY)) localStorage.removeItem(KEY);
  } catch (_) {}

  // مولّد توكن آمن بدون تخزين كلمة السر
  function genToken() {
    if (window.crypto && crypto.getRandomValues) {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    // فallback بسيط لو تعذّر WebCrypto
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2)
    );
  }

  // === التخزين المؤقت للجلسة داخل التبويب فقط ===
  function saveSession(s) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch (_) {}
  }
  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || "null");
    } catch (e) {
      return null;
    }
  }
  function clearSession() {
    try {
      sessionStorage.removeItem(KEY);
    } catch (_) {}
  }

  // التحقق وتسجيل الدخول
  function login(username, password) {
    const normalizedUser = (username || "").trim();

    if (!password) return { ok: false, error: "الرجاء إدخال كلمة السر" };
    const passOk = password === cfg.SHARED_PASSWORD;
    if (!passOk) return { ok: false, error: "كلمة السر غير صحيحة" };

    // السماح فقط بالمستخدمين المعرّفين في الإعدادات
    let role = null;
    if (normalizedUser === cfg.ADMIN_USERNAME) role = "admin";
    else if (normalizedUser === cfg.MEMBER_USERNAME) role = "member";
    else return { ok: false, error: "اسم مستخدم غير مسموح" };

    // إنشاء توكن عشوائي (لا يتم حفظ كلمة المرور إطلاقًا)
    const token = genToken();
    const session = { user: normalizedUser, role, token, at: Date.now() };

    saveSession(session);
    return { ok: true, session };
  }

  // تسجيل الخروج + إعادة التوجيه إلى صفحة الدخول
  function logout() {
    clearSession();
    const base =
      (window.SOA_CONFIG && window.SOA_CONFIG.BASE_PATH) ||
      (function () {
        const { protocol, hostname, pathname } = window.location;
        if (protocol === "file:") return "";
        if (/\.github\.io$/.test(hostname)) {
          const seg = pathname.split("/").filter(Boolean)[0];
          return seg ? `/${seg}/` : "/";
        }
        return "/";
      })();
    window.location.href = base + "login.html";
  }

  // تعريض دوال التوثيق للاستخدام العام
  window.SOA_AUTH = { login, logout, readSession, clearSession };
})();
