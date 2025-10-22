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

  // تنظيف أي جلسات قديمة كانت محفوظة في localStorage (النظام القديم)
  try {
    ["soa_session_v1"].forEach((k) => localStorage.removeItem(k));
  } catch (e) {}

  const read = window.SOA_AUTH && window.SOA_AUTH.readSession;
  const session = read ? read() : null;

  // إن لم توجد جلسة (أو أُبطلت بسبب تغيّر كلمة السر) و لسنا في صفحة الدخول -> اذهب لصفحة الدخول
  if (!session && !isLogin) {
    window.location.replace(base + "login.html");
    return;
  }

  // لو توجد جلسة، حدّد دور المستخدم على عنصر <html>
  if (session) {
    document.documentElement.setAttribute(
      "data-role",
      session.role || "member"
    );
  }

  // ===== حماية صفحات خاصة بالإدمن فقط =====
  const adminOnlyPatterns = [
    /strategy\.html$/i,
    /goals\.html$/i,
    /projects\/gallery/i,
    /projects\/new\/model\.html$/i,
    /projects\/new\/feasibility\.html$/i,
    /projects\/soa_phone\/model\.html$/i,
    /projects\/soa_phone\/feasibility\.html$/i,
  ];

  // التحقق إن كانت الصفحة الحالية من الصفحات المحمية
  const isAdminOnly = adminOnlyPatterns.some((re) => re.test(path));

  // لو الصفحة تتطلب صلاحية أدمن والمستخدم ليس أدمن -> تحويل إلى الصفحة الرئيسية أو رسالة منع
  if (isAdminOnly && session.role !== "admin") {
    alert("🚫 لا تملك صلاحية الوصول إلى هذه الصفحة.");
    window.location.replace(base + "index.html");
    return;
  }
})();
