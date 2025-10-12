// assets/js/guard.js
(function () {
  // احسب الـ base بشكل آمن لكل البيئات
  function getBase() {
    const cfgBase = (window.SOA_CONFIG && window.SOA_CONFIG.BASE_PATH) || null;
    if (cfgBase) return cfgBase.endsWith("/") ? cfgBase : cfgBase + "/";

    const { protocol, hostname, pathname } = window.location;
    if (protocol === "file:") return ""; // تشغيل محلي: مسارات نسبية
    if (/\.github\.io$/.test(hostname)) {
      // أول مجلد هو اسم الريبو على GH Pages
      const seg = pathname.split("/").filter(Boolean)[0];
      return seg ? `/${seg}/` : "/";
    }
    return "/"; // استضافة عادية
  }

  const base = getBase();
  const path = window.location.pathname || "";
  const isLoginPage = /(^|\/)login\.html?$/.test(path);

  const read = window.SOA_AUTH && window.SOA_AUTH.readSession;
  const session = read ? read() : null;

  // إن لم تكن مسجلاً و لست على صفحة الدخول -> أعد التوجيه
  if (!session && !isLoginPage) {
    window.location.replace(base + "login.html");
    return;
  }

  // لو عندك جلسة، عرّف الدور على <html>
  if (session) {
    document.documentElement.setAttribute(
      "data-role",
      session.role || "member"
    );
  }
})();
