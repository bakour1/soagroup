// assets\js\renderer.js
(function () {
  async function loadJSON(u) {
    const r = await fetch(u + "?v=" + Date.now());
    if (!r.ok) throw new Error("Fail " + u);
    return await r.json();
  }

  // === نفس التطبيع المستخدم في admin: نحول rows المخرنة كـ Maps إلى Arrays للعرض
  function normalizeFromCloud(data) {
    const clone = JSON.parse(JSON.stringify(data || {}));
    (clone.sections || []).forEach((sec) => {
      (sec.subsections || []).forEach((sub) => {
        if (sub && sub.table && Array.isArray(sub.table.headers)) {
          const cols = sub.table.headers.length;
          if (
            Array.isArray(sub.table.rows) &&
            sub.table.rows.length &&
            !Array.isArray(sub.table.rows[0])
          ) {
            sub.table.rows = sub.table.rows.map((r) => {
              const keys = Object.keys(r || {}).sort(
                (a, b) => Number(a.slice(1)) - Number(b.slice(1))
              );
              const out = [];
              for (let i = 0; i < cols; i++) out.push(r["c" + i] ?? "");
              return out;
            });
          }
        }
      });
    });
    return clone;
  }

  async function loadData(url) {
    if (
      window.FB &&
      typeof window.FB.loadDoc === "function" &&
      window.FB_DOC_PATH
    ) {
      try {
        const d = await window.FB.loadDoc(window.FB_DOC_PATH);
        if (d && Object.keys(d).length) return normalizeFromCloud(d);
      } catch (e) {
        console.warn("Firestore load failed (fallback to JSON):", e);
      }
    }
    const j = await loadJSON(url);
    return normalizeFromCloud(j);
  }

  function el(t, c) {
    const e = document.createElement(t);
    if (c) e.className = c;
    return e;
  }
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

    let s = String(val).trim();

    // 1) توحيد رموز السالب (Unicode minus & dashes) إلى ASCII hyphen -
    s = s.replace(/[\u2212\uFE63\uFF0D\u2010\u2011\u2012\u2013\u2014]/g, "-");

    // 2) التقاط صيغة الأقواس (تعني رقم سالب): (18000) => -18000
    const hadParens = /^\s*\(\s*.*\s*\)\s*$/.test(s);
    if (hadParens) s = s.replace(/[()]/g, "");

    // 3) توحيد الفواصل العربية
    s = s
      .replace(/\u066B/g, ".") // Arabic decimal separator
      .replace(/\u066C/g, ",") // Arabic thousands separator
      .replace(/\u060C/g, ","); // Arabic comma

    // 4) إزالة الفراغات العادية وغير القابلة للكسر
    s = s.replace(/[\u00A0\s]/g, "");

    // 5) السماح فقط بأرقام/فواصل/نقطة/سالب/ترميز علمي
    s = s.replace(/[^0-9.,\-eE]/g, "");

    // 6) حسم منطق الفواصل: آلاف vs. عشرية
    if (s.includes(".") && s.includes(",")) {
      // نحدد آخر فاصل للجزء العشري: أيهما يأتي أخيراً يُعدّ فاصلاً عشرياً
      const lastDot = s.lastIndexOf(".");
      const lastComma = s.lastIndexOf(",");
      if (lastComma > lastDot) {
        // الفاصلة عشريّة => أزل النقاط (آلاف) وحوّل آخر فاصلة لنقطة
        s = s.replace(/\./g, "");
        s = s.replace(/,/, ".");
        s = s.replace(/,/g, ""); // أي فواصل متبقية تُزال
      } else {
        // النقطة عشريّة => أزل كل الفواصل (تكون آلاف)
        s = s.replace(/,/g, "");
      }
    } else if (s.includes(",")) {
      // لو فقط فاصلة: جرّب نمط آلاف 1,234,567.89 => أزل الفواصل
      if (/\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
        s = s.replace(/,/g, "");
      } else {
        // خلاف ذلك اعتبرها عشريّة
        s = s.replace(/,/g, ".");
      }
    }

    // 7) حالات غير صالحة
    if (!s || s === "-" || s === "." || s === "-.") return NaN;

    let n = parseFloat(s);
    if (!Number.isFinite(n)) return NaN;
    if (hadParens) n = -Math.abs(n); // الأقواس تعني سالب
    return n;
  }

  function formatEn(num, frac = 2) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: frac,
    }).format(num);
  }

  function renderTable(tbl) {
    if (!tbl || !Array.isArray(tbl.headers) || !Array.isArray(tbl.rows))
      return null;

    // === استنتاج نوع كل عمود (أولوية لصيغة colFormats إن وُجدت)
    const inferType = (h, i) => {
      if (i === 0) return "text";
      const hs = String(h || "").toLowerCase();
      if (/\%/.test(hs) || /percent|النسبة/.test(hs)) return "percent";
      if (/\$/.test(hs) || /usd/.test(hs) || /دولار/.test(hs))
        return "currency";
      return "number";
    };
    let colTypes;
    if (Array.isArray(tbl.colFormats) && tbl.colFormats.length) {
      const inferred = tbl.headers.map(inferType);
      // طبّق ما توفر من colFormats ثم أكمل بالاستدلال
      colTypes = tbl.headers
        .map((_, i) => tbl.colFormats[i] || inferred[i])
        .slice(0, tbl.headers.length);
    } else {
      colTypes = tbl.headers.map(inferType);
    }

    const table = document.createElement("table");
    table.className = "table soatable";

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

    const colCount = tbl.headers.length;
    const sums = Array(colCount).fill(0);
    const hadVal = Array(colCount).fill(false);

    // مُنسِّق الخلية حسب النوع
    const formatCell = (num, type) => {
      const base = formatEn(num);
      if (type === "percent") return base + " %";
      if (type === "currency") return "$ " + base; // بدّلها إلى base + " $" لو بدك الرمز بعد الرقم
      return base;
    };

    const tbody = document.createElement("tbody");
    (tbl.rows || []).forEach((row) => {
      const tr = document.createElement("tr");
      for (let i = 0; i < colCount; i++) {
        const td = document.createElement("td");
        const cell = row && row[i] != null ? row[i] : "";
        const type = colTypes[i] || (i === 0 ? "text" : "number");

        if (i === 0 || type === "text") {
          td.textContent = String(cell);
        } else {
          const num = parseNumber(cell);
          td.classList.add("num-en");
          if (Number.isFinite(num)) {
            td.textContent = formatCell(num, type);
            sums[i] += num;
            hadVal[i] = true;
          } else {
            // لو الخلية نصّ (مثلاً "N/A") نعرضها فارغة رقمياً
            td.textContent = "";
          }
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    const hasFooter =
      Array.isArray(tbl.footer) &&
      tbl.footer.length > 0 &&
      tbl.footer.some((v) => String(v ?? "").trim() !== "");
    if (hasFooter) {
      const tfoot = document.createElement("tfoot");
      const trf = document.createElement("tr");
      const f0 = document.createElement("td");
      f0.textContent = tbl.footer[0] || "الإجمالي";
      trf.appendChild(f0);
      for (let i = 1; i < colCount; i++) {
        const tdf = document.createElement("td");
        tdf.classList.add("num-en");
        if (hadVal[i]) {
          tdf.textContent = formatCell(sums[i], colTypes[i] || "number");
        } else {
          tdf.textContent = "";
        }
        trf.appendChild(tdf);
      }
      tfoot.appendChild(trf);
      table.appendChild(tfoot);
    }
    return table;
  }

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
    const p = wrapEl("p", "", l.subtitle || "");
    titles.appendChild(h1);
    titles.appendChild(p);
    card.appendChild(titles);
    landingRoot.appendChild(card);
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
    const maintitleSection = "الأهداف: ";
    const mh = el("h2", "goals-title");
    mh.textContent = maintitleSection;
    arr.forEach((g) => {
      const card = el("article", "card goals-card");
      const h = el("h3", "card-title");
      h.textContent = g.subtitle || "";
      card.appendChild(h);
      const items = g.items || [];
      const total = items.length || 0;
      const done = items.filter((x) => x && x.done).length;
      const p = total ? Math.round((done / total) * 100) : 0;
      const row = el("div", "progress-row");
      const bar = el("div", "progress");
      const fill = el("div", "progress-fill");
      fill.style.width = p + "%";
      fill.setAttribute("aria-valuenow", String(p));
      bar.appendChild(fill);
      const meta = el("div", "progress-meta");
      const badge = el("span", "progress-badge wrap");
      badge.textContent = `${done}/${total}`;
      const percent = el("span", "progress-percent");
      percent.textContent = `${p}%`;
      meta.appendChild(percent);
      meta.appendChild(badge);
      row.appendChild(bar);
      row.appendChild(meta);
      card.appendChild(row);
      const ul = el("ul", "goals-list");
      items.forEach((it) => {
        const li = el("li", (it && it.done ? "goal done " : "goal ") + "wrap");
        li.textContent = (it && it.title) || "";
        ul.appendChild(li);
      });
      card.appendChild(ul);
      wrap.appendChild(card);
    });
    root.appendChild(mh);
    root.appendChild(wrap);
  }

  async function renderPage(url) {
    const root = document.querySelector("#app");
    root.innerHTML = "";
    const data = await loadData(url);
    renderLanding(root, data.landing);
    renderSections(root, data.sections);
    renderGoals(root, data.goals);
  }

  window.SOA_RENDER = { renderPage };
})();
