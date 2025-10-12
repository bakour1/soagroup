// assets\js\nav.js
(function () {
  function qs(id) {
    return document.getElementById(id);
  }

  const menuBtn = qs("menuBtn");
  const drawer = qs("mobileDrawer");
  const backdrop = qs("drawerBackdrop");
  const closeBtn = qs("closeDrawerBtn");
  const logoutDesktop = document.getElementById("logoutBtn");
  const logoutMobile = document.getElementById("logoutBtnMobile");
  const brandName = document.getElementById("brandName");
  const drawerBrand = document.getElementById("drawerBrand");

  if (brandName && drawerBrand) {
    drawerBrand.textContent = brandName.textContent || "SOA Group";
  }

  function openDrawer() {
    if (!drawer || !backdrop) return;
    drawer.classList.add("open");
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add("show"));
    document.body.classList.add("no-scroll");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
    drawer.setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    if (!drawer || !backdrop) return;
    drawer.classList.remove("open");
    backdrop.classList.remove("show");
    setTimeout(() => (backdrop.hidden = true), 200);
    document.body.classList.remove("no-scroll");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    drawer.setAttribute("aria-hidden", "true");
  }

  function toggleDrawer() {
    if (!drawer) return;
    if (drawer.classList.contains("open")) closeDrawer();
    else openDrawer();
  }

  // أحداث
  if (menuBtn) menuBtn.addEventListener("click", toggleDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (backdrop) backdrop.addEventListener("click", closeDrawer);

  // إغلاق عند الضغط على رابط داخل السايدبار
  if (drawer) {
    drawer.addEventListener("click", function (e) {
      const a = e.target.closest("a, button");
      if (a) closeDrawer();
    });
  }

  // Esc لإغلاق
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  // توحيد زر الخروج
  if (logoutDesktop)
    logoutDesktop.onclick = () =>
      window.SOA_AUTH.logout && window.SOA_AUTH.logout();
  if (logoutMobile)
    logoutMobile.onclick = () =>
      window.SOA_AUTH.logout && window.SOA_AUTH.logout();
})();
// Prefx anchors that start with "/" using BASE_PATH
(function prefixAnchorsToBase() {
  const base = (window.SOA_CONFIG && window.SOA_CONFIG.BASE_PATH) || "/";
  document.querySelectorAll('a[href^="/"]').forEach((a) => {
    const rel = a.getAttribute("href").slice(1); // remove leading "/"
    a.setAttribute("href", base + rel);
  });
})();
