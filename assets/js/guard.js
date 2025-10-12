// assets/js/guard.js
(function () {
  function getBase() {
    const cfgBase = (window.SOA_CONFIG && window.SOA_CONFIG.BASE_PATH) || null;
    if (cfgBase) return cfgBase.endsWith("/") ? cfgBase : cfgBase + "/";

    const { protocol, hostname, pathname } = window.location;
    if (protocol === "file:") return "";
    if (/\.github\.io$/.test(hostname)) {
      const seg = pathname.split("/").filter(Boolean)[0];
      return seg ? `/${seg}/` : "/";
    }
    return "/";
  }

  const base = getBase();
  const path = window.location.pathname || "";
  const isLogin = /(^|\/)login\.html?$/.test(path);

  const read = window.SOA_AUTH && window.SOA_AUTH.readSession;
  const session = read ? read() : null;

  if (!session && !isLogin) {
    window.location.replace(base + "login.html"); // 👈 الآن يوجّه إلى /soagroup/login.html
    return;
  }

  if (session) {
    document.documentElement.setAttribute(
      "data-role",
      session.role || "member"
    );
  }
})();
