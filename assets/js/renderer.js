// assets\js\renderer.js
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
  // ===== أرقام إنكليزية + جمع تلقائي =====

  function parseNumber(val) {
    if (typeof val === "number") return Number.isFinite(val) ? val : NaN;
    if (typeof val !== "string") return NaN;

    // استبدال الفواصل العربية/العادية
    // إذا كان كلاهما موجودين، نعتبر ',' فاصل آلاف ونزيله
    if (val.includes(",") && val.includes(".")) s = val.replace(/,/g, "");
    // الفاصلة العربية '،' والآلاف العربية U+066C
    s = val.replace(/\u060C|\u066C/g, ",").replace(/\u066B/g, "."); // 066B = Arabic decimal
    // إذا بقي فقط ',' نعتبرها فاصلة عشرية
    if (val.includes(",") && !val.includes(".")) s = val.replace(/,/g, ".");
    // إزالة أي رموز غير رقمية
    s = val.replace(/[^0-9.\-eE]/g, "");
    if (!s || s === "-" || s === "." || s === "-.") return NaN;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function formatEn(num, frac = 2) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: frac,
    }).format(num);
  }

  // يبني جدول مع جمع تلقائي عند وجود footer
  function renderTable(tbl) {
    if (!tbl || !Array.isArray(tbl.headers) || !Array.isArray(tbl.rows))
      return null;

    const table = document.createElement("table");
    table.className = "table soatable";

    // THEAD
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    tbl.headers.forEach((h, i) => {
      const th = document.createElement("th");
      th.textContent = h ?? "";
      if (i > 0) th.classList.add("num-en");
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    // جس نبني مجموع الأعمدة الرقمية ابتداءً من العمود 1 (نترك أول عمود نص)
    const colCount = tbl.headers.length;
    const sums = Array(colCount).fill(0);
    const hadVal = Array(colCount).fill(false);

    // TBODY
    const tbody = document.createElement("tbody");
    (tbl.rows || []).forEach((row) => {
      const tr = document.createElement("tr");
      for (let i = 0; i < colCount; i++) {
        const td = document.createElement("td");
        const cell = row && row[i] != null ? row[i] : "";

        if (i === 0) {
          // نص البند
          td.textContent = String(cell);
        } else {
          const num = parseNumber(cell);
          if (Number.isFinite(num)) {
            td.textContent = formatEn(num);
            td.classList.add("num-en");
            sums[i] += num;
            hadVal[i] = true;
          } else {
            // خلية غير رقمية/فارغة — تبقى فارغة بدون جمع
            td.textContent = "";
            td.classList.add("num-en"); // نضمن اتجاه LTR إن حصل إدخال لاحقًا
          }
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // TFOOT — فقط إذا وُجد footer في الداتا
    if (Array.isArray(tbl.footer)) {
      const tfoot = document.createElement("tfoot");
      const trf = document.createElement("tr");

      // أول خلية عنوان الإجمالي
      const f0 = document.createElement("td");
      f0.textContent = tbl.footer[0] || "الإجمالي";
      trf.appendChild(f0);

      // بقية الخلايا: نعرض المجموع إن كان هناك قيم فعلًا، وإلا نتركها فاضية
      for (let i = 1; i < colCount; i++) {
        const tdf = document.createElement("td");
        if (hadVal[i]) {
          tdf.textContent = formatEn(sums[i]);
        } else {
          tdf.textContent = "";
        }
        tdf.classList.add("num-en");
        trf.appendChild(tdf);
      }
      tfoot.appendChild(trf);
      table.appendChild(tfoot);
    }

    return table;
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

      // عنوان السكشن
      const h = el("h3", "card-title");
      h.textContent = s.title || "";
      // ملاحظة: لو تفضّل العنوان داخل الكارد، بدّل التالي إلى: card.appendChild(h);
      wrap.appendChild(h);

      (s.subsections || []).forEach((sub) => {
        const sw = el("div", "sub");

        if (sub.subtitle) {
          const sh = el("h4", "sub-title");
          sh.textContent = sub.subtitle || "";
          sw.appendChild(sh);
        }

        if (Array.isArray(sub.texts) && sub.texts.length) {
          const ul = el("ul", "text-list");
          sub.texts.forEach((t) => {
            const li = el("li", "wrap");
            li.textContent = t ?? "";
            ul.appendChild(li);
          });
          sw.appendChild(ul);
        }

        if (sub.table) {
          const tableEl = renderTable(sub.table);
          if (tableEl) sw.appendChild(tableEl);
        }

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
