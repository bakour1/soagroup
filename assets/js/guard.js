// assets\js\guard.js
(function () {
  const s = window.SOA_AUTH.readSession && window.SOA_AUTH.readSession();
  if (!s) {
    const { protocol, hostname, pathname } = window.location;
    let base = "/";

    // محليًا: لا تستخدم مسار مطلق
    if (protocol === "file:") {
      base = "";
    }
    // GitHub Pages (الموقع داخل مسار فرعي مثل /repo-name/)
    else if (/\.github\.io$/.test(hostname)) {
      const seg = pathname.split("/").filter(Boolean)[0]; // أول مجلد
      base = seg ? `/${seg}/` : "/";
    }

    // استخدام replace لتجنّب الرجوع للصفحة السابقة بعد تسجيل الخروج
    window.location.replace(base + "login.html");
    return;
  }
  document.documentElement.setAttribute("data-role", s.role || "member");
})();
