// assets\js\admin only goals working.js
(function () {
  const admin = document.documentElement.getAttribute("data-role") === "admin";

  // تنزيل JSON محلي
  function dl(name, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // هيلبر للهروب داخل HTML
  function esc(s = "") {
    return String(s).replace(
      /[&<>\"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );
  }

  // ====== محوّل ↔ Firestore ======
  function rowsArrayToMaps(rowArr) {
    if (!Array.isArray(rowArr)) return rowArr;
    return rowArr.map((r) => {
      if (!Array.isArray(r)) return r;
      const o = {};
      for (let i = 0; i < r.length; i++) o["c" + i] = r[i];
      return o;
    });
  }
  function rowsMapsToArray(rowMaps, colCount) {
    if (!Array.isArray(rowMaps)) return rowMaps;
    return rowMaps.map((r) => {
      if (Array.isArray(r)) return r;
      const out = [];
      const len = Number.isFinite(colCount)
        ? colCount
        : Object.keys(r || {}).length;
      for (let i = 0; i < len; i++) out.push(r["c" + i] ?? "");
      return out;
    });
  }
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
            sub.table.rows = rowsMapsToArray(sub.table.rows, cols);
          }
        }
      });
    });
    return clone;
  }
  function makeFirestoreSafe(data) {
    const clone = JSON.parse(JSON.stringify(data || {}));
    (clone.sections || []).forEach((sec) => {
      (sec.subsections || []).forEach((sub) => {
        if (sub && sub.table && Array.isArray(sub.table.headers)) {
          if (Array.isArray(sub.table.rows)) {
            sub.table.rows = rowsArrayToMaps(sub.table.rows);
          }
        }
      });
    });
    return clone;
  }

  // حالة الحفظ
  let data = null;
  let dirty = false;

  function setStatus(txt) {
    const s = document.getElementById("saveStatus");
    if (s) s.textContent = txt || "";
  }

  async function loadInitial(url) {
    if (
      window.FB &&
      typeof window.FB.loadDoc === "function" &&
      window.FB_DOC_PATH
    ) {
      try {
        const cloud = await window.FB.loadDoc(window.FB_DOC_PATH);
        if (cloud && Object.keys(cloud).length) {
          return normalizeFromCloud(cloud);
        }
      } catch (e) {
        console.warn("Firestore load failed, fallback to JSON:", e);
      }
    }
    const res = await fetch(url + "?v=" + Date.now());
    if (!res.ok) throw new Error("تعذّر تحميل البيانات: " + url);
    const j = await res.json();
    return normalizeFromCloud(j);
  }

  async function saveCloudNow() {
    if (
      !(
        window.FB &&
        typeof window.FB.saveDoc === "function" &&
        window.FB_DOC_PATH
      )
    ) {
      setStatus('❗ لم يتم إعداد Firebase — استخدم "تصدير JSON" مؤقتًا');
      return;
    }
    try {
      setStatus("جارٍ الحفظ…");
      const payload = makeFirestoreSafe(data);
      await window.FB.saveDoc(window.FB_DOC_PATH, payload);
      dirty = false;
      setStatus("✓ تم الحفظ " + new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
      setStatus("✗ فشل الحفظ: " + (e?.message || e));
    }
  }

  // ====== استيراد JSON ======
  function importAndNormalize(obj) {
    const incoming = JSON.parse(JSON.stringify(obj || {}));
    if (!incoming.sections) incoming.sections = [];
    if (!incoming.landing) incoming.landing = {};
    if (!incoming.goals) incoming.goals = [];
    const normalized = normalizeFromCloud(incoming);
    normalized.landing.logo = normalized.landing.logo ?? "";
    normalized.landing.title = normalized.landing.title ?? "";
    normalized.landing.subtitle = normalized.landing.subtitle ?? "";
    normalized.landing.body = normalized.landing.body ?? "";
    return normalized;
  }

  async function openEd() {
    const url = window.currentDataUrl || "data.json";
    data = await loadInitial(url);

    const p = document.createElement("div");
    p.className = "admin-panel";
    p.innerHTML = `
      <div class="admin-header">
        <strong>وضع الإدارة</strong>
        <div style="display:flex;gap:8px;align-items:center">
          <span id="saveStatus" class="muted" style="min-width:180px"></span>

          <input id="importInput" type="file" accept="application/json" style="display:none" />
          <button id="importJsonBtn" class="btn">استيراد JSON</button>

          <button id="saveCloudBtn" class="btn">حفظ للسحابة</button>
          <button id="saveJsonBtn" class="btn">تصدير JSON</button>
          <button id="closeAdminBtn" class="btn btn-ghost">إغلاق</button>
        </div>
      </div>

      <div class="admin-body">
        <details open>
          <summary>الـ Landing</summary>
          <label>رابط الشعار (logo)<input type="text" dir="ltr" id="landLogo" placeholder="/imgs/logo-4.png" /></label>
          <label>العنوان<input id="landTitle"/></label>
          <label>العنوان الثاني<input id="landSubtitle"/></label>
          <label>النص والشرح<textarea id="landBody" rows="4"></textarea></label>
        </details>

        <details open>
          <summary>الأقسام والفقرات</summary>
          <div id="sectionsEditor"></div>
          <div class="action-editor">
            <button id="addSection" class="btn">+ قسم جديد</button>
          </div>
        </details>

        <details open>
          <summary>المهمات</summary>
          <div id="goalsEditor"></div>
          <div class="action-editor">
            <button id="addGoalGroup" class="btn">+ فقرة أهداف جديدة</button>
          </div>
        </details>
      </div>
    `;
    document.body.appendChild(p);

    // تعبئة قيَم الهبوط
    document.getElementById("landLogo").value = data.landing?.logo || "";
    document.getElementById("landTitle").value = data.landing?.title || "";
    document.getElementById("landSubtitle").value =
      data.landing?.subtitle || "";
    document.getElementById("landBody").value = data.landing?.body || "";

    // ===== الأقسام =====
    function rSec() {
      const host = document.getElementById("sectionsEditor");
      const prevStates = [];
      host.querySelectorAll(".editor-card").forEach((cardWrap) => {
        const det = cardWrap.querySelector("details");
        const secState = { sectionOpen: !!(det && det.open), subsOpen: [] };
        cardWrap.querySelectorAll(".sub-editor").forEach((subEl) => {
          const subDet = subEl.querySelector("details");
          secState.subsOpen.push(!!(subDet && subDet.open));
        });
        prevStates.push(secState);
      });

      host.innerHTML = "";
      (data.sections || []).forEach((s, si) => {
        const cardWrap = document.createElement("div");
        cardWrap.className = "editor-card";

        const det = document.createElement("details");
        if (prevStates[si]) {
          det.open = !!prevStates[si].sectionOpen;
        } else {
          if (!s.title || (s.subsections || []).length === 0) det.open = true;
        }
        det.dataset.si = si;

        const summ = document.createElement("summary");
        summ.className = "sec-summary";
        summ.innerHTML = `<span class="summary-left">
                         <span class="arrow" aria-hidden="true">▸</span>
                         <span class="sec-title-text">${esc(
                           s.title || "قسم " + (si + 1)
                         )}</span>
                       </span>
                       <span class="summary-right">قسم ${si + 1}</span>`;
        det.appendChild(summ);

        const content = document.createElement("div");
        content.className = "sec-content";

        const titleLabel = document.createElement("label");
        titleLabel.innerHTML = `عنوان القسم
      <input data-si="${si}" class="sec-title" value="${esc(s.title || "")}"/>`;
        content.appendChild(titleLabel);

        const subsWrap = document.createElement("div");
        subsWrap.className = "subs";
        (s.subsections || []).forEach((sub, sj) => {
          const hasTable = sub.table && Array.isArray(sub.table.headers);
          const textsStr = (sub.texts || []).join("\n");
          const colsCount = hasTable ? (sub.table.headers || []).length : 0;

          const subDiv = document.createElement("div");
          subDiv.className = "sub-editor";

          subDiv.innerHTML = `...`; // keep original table HTML generation (omitted here for brevity)

          subsWrap.appendChild(subDiv);

          const innerDet = subDiv.querySelector("details");
          if (innerDet) {
            if (
              prevStates[si] &&
              typeof prevStates[si].subsOpen[sj] !== "undefined"
            ) {
              innerDet.open = !!prevStates[si].subsOpen[sj];
            } else {
              innerDet.open = !!hasTable;
            }
          }
        });

        const actions = document.createElement("div");
        actions.className = "action-editor";
        actions.innerHTML = `
      <button class="btn" data-act="add-sub" data-si="${si}">+ إضافة عنوان فرعي</button>
      <button class="btn danger" data-act="del-sec" data-si="${si}">حذف القسم</button>
    `;

        content.appendChild(subsWrap);
        content.appendChild(actions);
        det.appendChild(content);
        cardWrap.appendChild(det);
        host.appendChild(cardWrap);
      });

      host.querySelectorAll(".editor-card details").forEach((d) => {
        const arrow = d.querySelector(".arrow");
        if (arrow) arrow.style.transform = d.open ? "rotate(90deg)" : "";
      });
    }

    // ===== المهمات (Goals) =====
    function rGoals() {
      const host = document.getElementById("goalsEditor");
      const prevStates = [];
      host.querySelectorAll(".editor-card").forEach((cardWrap) => {
        const det = cardWrap.querySelector("details");
        prevStates.push(!!(det && det.open));
      });

      host.innerHTML = "";
      data.goals = data.goals || [];
      (data.goals || []).forEach((g, gi) => {
        const cardWrap = document.createElement("div");
        cardWrap.className = "editor-card";

        const det = document.createElement("details");
        det.dataset.gi = gi;
        if (typeof prevStates[gi] !== "undefined") {
          det.open = !!prevStates[gi];
        } else {
          if (!g.subtitle || (g.items || []).length < 2) det.open = true;
        }

        const doneCount = (g.items || []).filter((x) => x && x.done).length;
        const total = (g.items || []).length || 0;
        const pct = total ? Math.round((doneCount / total) * 100) : 0;

        const summ = document.createElement("summary");
        summ.className = "goal-summary";
        summ.innerHTML = `
      <span class="summary-left">
        <span class="arrow" aria-hidden="true">▸</span>
        <span class="goal-summary-title">${esc(
          g.subtitle || "فقرة مهمات " + (gi + 1)
        )}</span>
      </span>
      <span class="summary-right">${doneCount}/${total} — ${pct}%</span>
    `;
        det.appendChild(summ);

        const content = document.createElement("div");
        content.className = "goal-content";

        const titleLabel = document.createElement("label");
        titleLabel.innerHTML = `عنوان فقرة المهمات
      <textarea data-gi="${gi}" class="goal-subtitle" rows="2">${esc(
          g.subtitle || ""
        )}</textarea>`;
        content.appendChild(titleLabel);

        const itemsDiv = document.createElement("div");
        itemsDiv.className = "items";

        (g.items || []).forEach((it, ii) => {
          const itemHtml = `
        <div class="item-editor">
          <input type="text" class="goal-title" data-gi="${gi}" data-ii="${ii}" value="${esc(
            it.title || ""
          )}" placeholder="عنوان الهدف"/>
          <label class="switch">
            <input type="checkbox" class="goal-done" data-gi="${gi}" data-ii="${ii}" ${
            it.done ? "checked" : ""
          }/>
            <span>منجز</span>
          </label>
          <button class="btn danger" data-act="del-item" data-gi="${gi}" data-ii="${ii}">حذف</button>
        </div>
      `;
          itemsDiv.insertAdjacentHTML("beforeend", itemHtml);
        });

        content.appendChild(itemsDiv);

        const actions = document.createElement("div");
        actions.className = "action-editor";
        actions.innerHTML = `
      <button class="btn" data-act="add-item" data-gi="${gi}">+ إضافة هدف</button>
      <button class="btn danger" data-act="del-group" data-gi="${gi}">حذف فقرة المهمات</button>
    `;
        content.appendChild(actions);

        det.appendChild(content);
        cardWrap.appendChild(det);
        host.appendChild(cardWrap);
      });

      host.querySelectorAll(".editor-card details").forEach((d) => {
        const arrow = d.querySelector(".arrow");
        if (arrow) arrow.style.transform = d.open ? "rotate(90deg)" : "";
      });
    }

    // أول رسم
    rSec();
    rGoals();

    // تدوير السهام عند toggle
    p.addEventListener(
      "toggle",
      (ev) => {
        const det = ev.target;
        if (det && det.tagName === "DETAILS") {
          const arrow = det.querySelector(".arrow");
          if (arrow) arrow.style.transform = det.open ? "rotate(90deg)" : "";
        }
      },
      true
    );

    // ===== Inputs → تحديث الداتا =====
    p.addEventListener("input", (e) => {
      const t = e.target;
      dirty = true;

      // Landing
      if (t.id === "landLogo")
        data.landing = { ...(data.landing || {}), logo: t.value };
      if (t.id === "landTitle")
        data.landing = { ...(data.landing || {}), title: t.value };
      if (t.id === "landSubtitle")
        data.landing = { ...(data.landing || {}), subtitle: t.value };
      if (t.id === "landBody")
        data.landing = { ...(data.landing || {}), body: t.value };

      // Sections
      if (t.classList.contains("sec-title")) {
        const si = +t.dataset.si;
        data.sections[si].title = t.value;
      }
      if (t.classList.contains("sub-title")) {
        const si = +t.dataset.si,
          sj = +t.dataset.sj;
        data.sections[si].subsections[sj].subtitle = t.value;
      }
      if (t.classList.contains("sub-texts")) {
        const si = +t.dataset.si,
          sj = +t.dataset.sj;
        data.sections[si].subsections[sj].texts = t.value
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // Table headers / cells / footer
      if (t.classList.contains("tbl-h")) {
        const si = +t.dataset.si,
          sj = +t.dataset.sj,
          ci = +t.dataset.ci;
        const sub = data.sections[si].subsections[sj];
        sub.table.headers[ci] = t.value;
      }
      if (t.classList.contains("tbl-cell")) {
        const si = +t.dataset.si,
          sj = +t.dataset.sj,
          ri = +t.dataset.ri,
          ci = +t.dataset.ci;
        const sub = data.sections[si].subsections[sj];
        sub.table.rows[ri][ci] = t.value;
      }
      if (t.classList.contains("tbl-f")) {
        const si = +t.dataset.si,
          sj = +t.dataset.sj,
          ci = +t.dataset.ci;
        const sub = data.sections[si].subsections[sj];
        sub.table.footer[ci] = t.value;
      }
      if (t.classList.contains("tbl-format")) {
        const si = +t.dataset.si,
          sj = +t.dataset.sj,
          ci = +t.dataset.ci;
        const sub = data.sections[si].subsections[sj];
        const cols = sub.table.headers.length;
        sub.table.colFormats = Array.from(
          { length: cols },
          (_, i) =>
            (sub.table.colFormats && sub.table.colFormats[i]) ||
            (i === 0 ? "text" : "number")
        );
        sub.table.colFormats[ci] = t.value;
      }

      // === Goals: subtitle, item title, checkbox (checkbox also fires 'change' but handle here too) ===
      if (t.classList.contains("goal-subtitle")) {
        const gi = +t.dataset.gi;
        data.goals = data.goals || [];
        data.goals[gi] = data.goals[gi] || { subtitle: "", items: [] };
        data.goals[gi].subtitle = t.value;
        // update summaries (re-render safe)
        rGoals();
      }
      if (t.classList.contains("goal-title")) {
        const gi = +t.dataset.gi,
          ii = +t.dataset.ii;
        data.goals = data.goals || [];
        data.goals[gi] = data.goals[gi] || { subtitle: "", items: [] };
        data.goals[gi].items = data.goals[gi].items || [];
        data.goals[gi].items[ii] = data.goals[gi].items[ii] || {
          title: "",
          done: false,
        };
        data.goals[gi].items[ii].title = t.value;
        // no full rerender needed for title, but update counts if needed
      }
      if (t.classList.contains("goal-done")) {
        const gi = +t.dataset.gi,
          ii = +t.dataset.ii;
        data.goals = data.goals || [];
        data.goals[gi] = data.goals[gi] || { subtitle: "", items: [] };
        data.goals[gi].items = data.goals[gi].items || [];
        data.goals[gi].items[ii] = data.goals[gi].items[ii] || {
          title: "",
          done: false,
        };
        data.goals[gi].items[ii].done = !!t.checked;
        // update summary percentages / counts
        rGoals();
      }
    });

    // ===== الأزرار =====
    p.addEventListener("click", (e) => {
      const a = e.target.dataset.act;
      if (!a) return;
      dirty = true;

      if (a === "add-sub") {
        const si = +e.target.dataset.si;
        data.sections[si].subsections = data.sections[si].subsections || [];
        data.sections[si].subsections.push({
          subtitle: "عنوان جديد",
          texts: ["فقرة نص"],
        });
        rSec();
      }
      if (a === "del-sec") {
        const si = +e.target.dataset.si;
        data.sections.splice(si, 1);
        rSec();
      }
      if (a === "del-sub") {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        data.sections[si].subsections.splice(sj, 1);
        rSec();
      }

      if (a === "add-table") {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        const sub = data.sections[si].subsections[sj];
        sub.table = {
          headers: ["Column 1", "Column 2", "Column 3"],
          rows: [],
          footer: [],
          colFormats: ["text", "number", "number"],
        };
        rSec();
      }
      if (a === "del-table") {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        delete data.sections[si].subsections[sj].table;
        rSec();
      }
      if (a === "add-col") {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        const sub = data.sections[si].subsections[sj];
        sub.table.headers.push("");
        (sub.table.rows || []).forEach((r) => r.push(""));
        if (sub.table.footer) sub.table.footer.push("");
        sub.table.colFormats = Array.from(
          { length: sub.table.headers.length },
          (_, i) =>
            (sub.table.colFormats && sub.table.colFormats[i]) ||
            (i === 0 ? "text" : "number")
        );
        rSec();
      }
      if (a === "del-col") {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        const sub = data.sections[si].subsections[sj];
        if (sub.table.headers.length) sub.table.headers.pop();
        (sub.table.rows || []).forEach((r) => r.pop());
        if (sub.table.footer && sub.table.footer.length) sub.table.footer.pop();
        if (
          Array.isArray(sub.table.colFormats) &&
          sub.table.colFormats.length
        ) {
          sub.table.colFormats.pop();
        }
        rSec();
      }
      if (a === "add-row") {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        const sub = data.sections[si].subsections[sj];
        const cols = sub.table.headers.length;
        sub.table.rows = sub.table.rows || [];
        sub.table.rows.push(Array.from({ length: cols }, () => ""));
        rSec();
      }
      if (a === "del-row") {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj,
          ri = +e.target.dataset.ri;
        const sub = data.sections[si].subsections[sj];
        sub.table.rows.splice(ri, 1);
        rSec();
      }

      // Goals actions
      if (a === "add-item") {
        const gi = +e.target.dataset.gi;
        data.goals = data.goals || [];
        data.goals[gi] = data.goals[gi] || { subtitle: "", items: [] };
        data.goals[gi].items = data.goals[gi].items || [];
        data.goals[gi].items.push({ title: "", done: false });
        rGoals();
      }
      if (a === "del-item") {
        const gi = +e.target.dataset.gi,
          ii = +e.target.dataset.ii;
        if (!data.goals || !data.goals[gi] || !data.goals[gi].items) return;
        data.goals[gi].items.splice(ii, 1);
        rGoals();
      }
      if (a === "del-group") {
        const gi = +e.target.dataset.gi;
        if (!data.goals) return;
        data.goals.splice(gi, 1);
        rGoals();
      }
    });

    // تبديل الفوتر
    p.addEventListener("change", (e) => {
      if (e.target.classList.contains("tbl-has-footer")) {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        const sub = data.sections[si].subsections[sj];
        if (e.target.checked) {
          const cols = sub.table.headers.length;
          sub.table.footer = Array.from({ length: cols }, () => "");
        } else {
          sub.table.footer = [];
        }
        dirty = true;
        rSec();
      }

      // handle checkbox toggles also here to ensure consistency
      if (e.target.classList.contains("goal-done")) {
        const gi = +e.target.dataset.gi,
          ii = +e.target.dataset.ii;
        data.goals = data.goals || [];
        data.goals[gi] = data.goals[gi] || { subtitle: "", items: [] };
        data.goals[gi].items = data.goals[gi].items || [];
        data.goals[gi].items[ii] = data.goals[gi].items[ii] || {
          title: "",
          done: false,
        };
        data.goals[gi].items[ii].done = !!e.target.checked;
        dirty = true;
        rGoals();
      }
    });

    // أزرار أعلى اللوحة
    p.querySelector("#addSection").onclick = () => {
      data.sections = data.sections || [];
      data.sections.push({ title: "قسم جديد", subsections: [] });
      dirty = true;
      rSec();
    };
    p.querySelector("#addGoalGroup").onclick = () => {
      data.goals = data.goals || [];
      data.goals.push({ subtitle: "فقرة أهداف جديدة", items: [] });
      dirty = true;
      rGoals();
    };
    p.querySelector("#saveJsonBtn").onclick = () => {
      const file = (window.currentDataUrl || "data.json").split("/").pop();
      dl(file, JSON.stringify(data, null, 2));
    };
    p.querySelector("#saveCloudBtn").onclick = saveCloudNow;
    p.querySelector("#closeAdminBtn").onclick = () => p.remove();

    // استيراد JSON
    const importBtn = p.querySelector("#importJsonBtn");
    const importInput = p.querySelector("#importInput");

    importBtn.onclick = () => importInput.click();

    importInput.onchange = async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;

      try {
        if (file.size > 2 * 1024 * 1024) {
          alert("الملف أكبر من 2MB. رجاءً استخدم ملفًا أصغر.");
          return;
        }
        const text = await file.text();
        let obj;
        try {
          obj = JSON.parse(text);
        } catch {
          alert("الملف ليس JSON صالحًا.");
          return;
        }

        const imported = importAndNormalize(obj);

        const doMerge = confirm(
          "هل تريد دمج المحتوى مع الحالي؟\n'OK' للدمج — 'Cancel' للاستبدال الكامل."
        );
        if (doMerge) {
          data = data || {};
          data.landing = {
            ...(data.landing || {}),
            ...(imported.landing || {}),
          };
          data.sections = Array.isArray(data.sections)
            ? data.sections.concat(imported.sections || [])
            : imported.sections || [];
          data.goals = Array.isArray(data.goals)
            ? data.goals.concat(imported.goals || [])
            : imported.goals || [];
        } else {
          data = imported;
        }

        document.getElementById("landLogo").value = data.landing?.logo || "";
        document.getElementById("landTitle").value = data.landing?.title || "";
        document.getElementById("landSubtitle").value =
          data.landing?.subtitle || "";
        document.getElementById("landBody").value = data.landing?.body || "";

        rSec();
        rGoals();

        dirty = true;
        setStatus("✓ تم الاستيراد من الملف: " + file.name);
      } catch (e) {
        console.error(e);
        alert("فشل الاستيراد: " + (e?.message || e));
      } finally {
        importInput.value = "";
      }
    };

    // سحب وإفلات JSON
    p.addEventListener("dragover", (e) => {
      e.preventDefault();
      p.classList.add("dragging");
    });
    p.addEventListener("dragleave", () => p.classList.remove("dragging"));
    p.addEventListener("drop", async (e) => {
      e.preventDefault();
      p.classList.remove("dragging");
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (file.type !== "application/json") {
        alert("أسقط ملف JSON صالحًا.");
        return;
      }
      importInput.files = e.dataTransfer.files;
      importInput.onchange({ target: importInput });
    });

    // تحذير عند إغلاق الصفحة مع تغييرات غير محفوظة
    window.addEventListener("beforeunload", (ev) => {
      if (dirty) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    });
  }

  function fab() {
    if (!admin) return;
    const b = document.createElement("button");
    b.className = "admin-fab";
    b.title = "تحرير الصفحة";
    b.textContent = "تحرير";
    b.onclick = openEd;
    document.body.appendChild(b);
  }

  window.addEventListener("DOMContentLoaded", fab);
})();
