(function () {
  async function loadJSON(u) {
    const r = await fetch(u + "?v=" + Date.now());
    if (!r.ok) throw new Error("Fail " + u);
    return await r.json();
  }
  function el(t, c) {
    const e = document.createElement(t);
    if (c) e.className = c;
    return e;
  }
  // عنصر نص يحافظ على لفّ الأسطر كما أُدخلت
  function wrapEl(tag, cls, text) {
    const e = el(tag, (cls ? cls + " " : "") + "wrap");
    e.textContent = text ?? "";
    return e;
  }
  function progress(items) {
    if (!Array.isArray(items) || !items.length) return 0;
    const d = items.filter((x) => x.done).length;
    return Math.round((d / items.length) * 100);
  }

  // Landing بشكل الكرت + البسملة، مع الحفاظ على الأسطر
  function renderLanding(root, l) {
    if (!l) return;
    const landingRoot = document.createElement("landing");

    const card = el("section", "landing-card card");
    const logo = el("img", "logo");
    logo.setAttribute("referrerpolicy", "no-referrer");
    logo.alt = "شعار SOA Group";
    const cfg = window.SOA_CONFIG || {};
    logo.src = l.logo || cfg.LOGO_URL || "imgs/logo-2.png";
    card.appendChild(logo);

    const titles = el("div", "titles");
    const h1 = el("h1");
    h1.textContent = l.title || "";
    const p = wrapEl("p", "", l.subtitle || ""); // يحافظ على الأسطر
    titles.appendChild(h1);
    titles.appendChild(p);
    card.appendChild(titles);
    landingRoot.appendChild(card);

    // body أو basmala (نفس الكرت — مع لف الأسطر)
    if (l.body || l.basmala) {
      const bodySection = el("section", "card");
      bodySection.appendChild(wrapEl("p", "", l.body ?? l.basmala ?? ""));
      landingRoot.appendChild(bodySection);
    }

    root.appendChild(landingRoot);
  }

  function renderSections(root, arr) {
    if (!Array.isArray(arr)) return;
    const wrap = el("section", "sections");
    arr.forEach((s) => {
      const card = el("article", "card");
      const h = el("h3", "card-title");
      h.textContent = s.title || "";
      wrap.appendChild(h);

      (s.subsections || []).forEach((sub) => {
        const sw = el("div", "sub");
        const sh = el("h4", "sub-title");
        sh.textContent = sub.subtitle || "";
        sw.appendChild(sh);

        const ul = el("ul", "text-list");
        (sub.texts || []).forEach((t) => {
          const li = el("li", "wrap"); // يحافظ على الأسطر داخل العنصر
          li.textContent = t ?? "";
          ul.appendChild(li);
        });
        sw.appendChild(ul);
        card.appendChild(sw);
      });

      wrap.appendChild(card);
    });
    root.appendChild(wrap);
  }

  function renderGoals(root, arr) {
    if (!Array.isArray(arr)) return;
    const wrap = el("section", "goals");

    arr.forEach((g) => {
      const card = el("article", "card goals-card");

      // العنوان
      const h = el("h3", "card-title");
      h.textContent = g.subtitle || "";
      card.appendChild(h);

      // احسب التقدم + العدّاد
      const items = g.items || [];
      const total = items.length || 0;
      const done = items.filter((x) => x && x.done).length;
      const p = total ? Math.round((done / total) * 100) : 0;

      // صف يعرض الشريط + الميتا بجانبه
      const row = el("div", "progress-row");

      // الشريط
      const bar = el("div", "progress");
      const fill = el("div", "progress-fill");
      fill.style.width = p + "%";
      fill.setAttribute("aria-valuenow", String(p));
      bar.appendChild(fill);

      // الميتا: (مكتمل/إجمالي) + (النسبة%)
      const meta = el("div", "progress-meta");
      const badge = el("span", "progress-badge wrap");
      badge.textContent = `${done}/${total}`;
      const percent = el("span", "progress-percent");
      percent.textContent = `${p}%`;

      meta.appendChild(percent);
      meta.appendChild(badge);

      // دمجهم في صف واحد
      row.appendChild(bar);
      row.appendChild(meta);
      card.appendChild(row);

      // قائمة الأهداف
      const ul = el("ul", "goals-list");
      items.forEach((it) => {
        const li = el("li", (it && it.done ? "goal done " : "goal ") + "wrap");
        li.textContent = (it && it.title) || "";
        ul.appendChild(li);
      });
      card.appendChild(ul);

      wrap.appendChild(card);
    });

    root.appendChild(wrap);
  }

  async function renderPage(url) {
    const root = document.querySelector("#app");
    root.innerHTML = "";
    const data = await loadJSON(url);
    renderLanding(root, data.landing);
    renderSections(root, data.sections);
    renderGoals(root, data.goals);
  }

  window.SOA_RENDER = { renderPage };
})();
