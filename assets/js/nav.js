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
// ===== Dropdown (Projects) toggle for touch/click =====
(function () {
  const rootMenu = document.querySelector(".nav .nav-links .menu.has-dropdown");
  if (!rootMenu) return;

  const btn = rootMenu.querySelector(".menu-btn");
  const level1 = rootMenu.querySelector(".dropdown.level-1");

  // فتح/إغلاق المستوى الأول
  if (btn && level1) {
    btn.addEventListener("click", (e) => {
      // على الشاشات اللمسية/أو إذا ما في hover نستخدم toggle
      const supportsHover = window.matchMedia("(hover: hover)").matches;
      if (supportsHover) return; // على الديسكتوب الهوفر يكفي
      e.preventDefault();
      const open = rootMenu.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // إغلاق عند الضغط خارج
    document.addEventListener("click", (e) => {
      if (!rootMenu.contains(e.target)) {
        rootMenu.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
        rootMenu
          .querySelectorAll(".has-dropdown.open")
          .forEach((li) => li.classList.remove("open"));
      }
    });
  }

  // فتح/إغلاق المستوى الثاني
  rootMenu.querySelectorAll(".submenu-title").forEach((title) => {
    const li = title.closest("li.has-dropdown");
    const sub = li && li.querySelector(".dropdown.level-2");
    if (!li || !sub) return;

    title.addEventListener("click", (e) => {
      const supportsHover = window.matchMedia("(hover: hover)").matches;
      if (supportsHover) return; // الهوفر يكفي على الديسكتوب
      e.preventDefault();
      li.classList.toggle("open");
    });
  });
})();
// ===== Only one accordion open per level (mobile drawer) =====
(function () {
  const drawer = document.getElementById("mobileDrawer");
  if (!drawer) return;

  // مجموعة المستوى الأول: داخل li.accordion
  const topDetails = drawer.querySelectorAll(".accordion > details");
  topDetails.forEach((d) => {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      topDetails.forEach((o) => {
        if (o !== d) o.open = false;
      });
    });
  });

  // مجموعات المستوى الثاني: داخل .accordion-group
  drawer.querySelectorAll(".accordion-group").forEach((group) => {
    const secondLevel = group.querySelectorAll(":scope > details");
    secondLevel.forEach((d) => {
      d.addEventListener("toggle", () => {
        if (!d.open) return;
        secondLevel.forEach((o) => {
          if (o !== d) o.open = false;
        });
      });
    });
  });

  // إغلاق السلايدبار عند الضغط على أي رابط
  drawer.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const backdrop = document.getElementById("drawerBackdrop");
    drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("show");
    document.body.classList.remove("no-scroll");
  });
})();
(function hideAdminLinks() {
  const role = document.documentElement.getAttribute("data-role");
  if (role !== "admin") {
    document.querySelectorAll("[data-admin-only]").forEach((el) => el.remove());
  }
})();
