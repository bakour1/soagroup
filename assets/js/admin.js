// assets/js/admin.js
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
  // يحوّل rows: Array<Array>  --> Array<Map> { c0:..., c1:... } (مناسب لـ Firestore)
  function rowsArrayToMaps(rowArr) {
    if (!Array.isArray(rowArr)) return rowArr;
    return rowArr.map((r) => {
      if (!Array.isArray(r)) return r;
      const o = {};
      for (let i = 0; i < r.length; i++) o["c" + i] = r[i];
      return o;
    });
  }
  // عكس السابق: Array<Map> --> Array<Array> بالترتيب c0,c1,c2... (مناسب للمحرر)
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
  // يمشي على الشجرة ويحوّل كل الجداول إلى Arrays للعرض داخل المحرر
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
            // rows محفوظة كـ Maps -> رجّعها Arrays للواجهة
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
            // حوّل المصفوفات المتداخلة لمابات لتجنّب nested arrays في Firestore
            sub.table.rows = rowsArrayToMaps(sub.table.rows);
          }
          // headers و footer تبقى Arrays (لا مشكلة)
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

  // تحميل مبدئي: جرّب Firestore ثم FALLBACK إلى JSON
  async function loadInitial(url) {
    // قراءة من Firestore
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
    // JSON محلي
    const res = await fetch(url + "?v=" + Date.now());
    if (!res.ok) throw new Error("تعذّر تحميل البيانات: " + url);
    const j = await res.json();
    return normalizeFromCloud(j);
  }

  // حفظ فوري إلى السحابة
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
    // يسمح بوجود حقول إضافية، ويركّز على الحقول الداعمة
    const incoming = JSON.parse(JSON.stringify(obj || {}));

    // ضمان المفاتيح الأساسية
    if (!incoming.sections) incoming.sections = [];
    if (!incoming.landing) incoming.landing = {};
    if (!incoming.goals) incoming.goals = [];

    // تطبيع الجداول (خاصة لو جاءت كـ Maps من Firestore أو Arrays خام)
    const normalized = normalizeFromCloud(incoming);

    // تعيين قيم افتراضية آمنة
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

          <!-- استيراد JSON -->
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
      host.innerHTML = "";
      (data.sections || []).forEach((s, si) => {
        const card = document.createElement("div");
        card.className = "editor-card";
        const subs = s.subsections || [];
        card.innerHTML = `
          <label>عنوان القسم
            <input data-si="${si}" class="sec-title" value="${esc(
          s.title || ""
        )}"/>
          </label>
          <div class="subs"></div>
          <div class="action-editor">
            <button class="btn" data-act="add-sub" data-si="${si}">+ إضافة عنوان فرعي</button>
            <button class="btn danger" data-act="del-sec" data-si="${si}">حذف القسم</button>
          </div>
        `;
        const subsWrap = card.querySelector(".subs");

        subs.forEach((sub, sj) => {
          const hasTable = sub.table && Array.isArray(sub.table.headers);
          const textsStr = (sub.texts || []).join("\n");
          const colsCount = hasTable ? (sub.table.headers || []).length : 0;

          const subDiv = document.createElement("div");
          subDiv.className = "sub-editor";
          subDiv.innerHTML = `
            <label>عنوان فرعي
              <input data-si="${si}" data-sj="${sj}" class="sub-title" value="${esc(
            sub.subtitle || ""
          )}"/>
            </label>

            <label>النصوص (كل سطر نص)
              <textarea rows="4" data-si="${si}" data-sj="${sj}" class="sub-texts">${esc(
            textsStr
          )}</textarea>
            </label>

            <details ${hasTable ? "open" : ""}>
              <summary>جدول (اختياري)</summary>
              <div class="table-editor" data-si="${si}" data-sj="${sj}">
                ${
                  hasTable
                    ? `
                  <div class="tbl-row">
                    <strong>العناوين (Headers)</strong>
                    <div class="tbl-grid tbl-headers">
                      ${(sub.table.headers || [])
                        .map(
                          (h, ci) =>
                            `<input class="tbl-h" data-si="${si}" data-sj="${sj}" data-ci="${ci}" value="${esc(
                              h
                            )}" />`
                        )
                        .join("")}
                    </div>
                    <div class="action-editor">
                      <button class="btn" data-act="add-col" data-si="${si}" data-sj="${sj}">+ عمود</button>
                      <button class="btn danger" data-act="del-col" data-si="${si}" data-sj="${sj}">حذف آخر عمود</button>
                    </div>
                  </div>

                  <div class="tbl-row">
                    <strong>الصفوف (Rows)</strong>
                    <div class="tbl-rows" data-si="${si}" data-sj="${sj}">
                      ${(sub.table.rows || [])
                        .map(
                          (row, ri) => `
                          <div class="tbl-grid">
                            ${Array.from({ length: colsCount })
                              .map(
                                (_, ci) =>
                                  `<input class="tbl-cell" data-si="${si}" data-sj="${sj}" data-ri="${ri}" data-ci="${ci}" value="${esc(
                                    row?.[ci] ?? ""
                                  )}" />`
                              )
                              .join("")}
                            <button class="btn danger" data-act="del-row" data-si="${si}" data-sj="${sj}" data-ri="${ri}">حذف الصف</button>
                          </div>
                        `
                        )
                        .join("")}
                    </div>
                    <div class="action-editor">
                      <button class="btn" data-act="add-row" data-si="${si}" data-sj="${sj}">+ صف</button>
                      <button class="btn danger" data-act="del-table" data-si="${si}" data-sj="${sj}">حذف الجدول</button>
                    </div>
                  </div>

                  <div class="tbl-row">
                    <label class="switch">
                      <input type="checkbox" class="tbl-has-footer" data-si="${si}" data-sj="${sj}" ${
                        sub.table.footer && sub.table.footer.length
                          ? "checked"
                          : ""
                      }/>
                      <span>تفعيل صف الفوتر (Footer)</span>
                    </label>
                    <div class="tbl-grid tbl-footer" ${
                      sub.table.footer && sub.table.footer.length
                        ? ""
                        : 'style="display:none"'
                    }>
                      ${Array.from({ length: colsCount })
                        .map(
                          (_, ci) =>
                            `<input class="tbl-f" data-si="${si}" data-sj="${sj}" data-ci="${ci}" value="${esc(
                              sub.table.footer?.[ci] ?? ""
                            )}" />`
                        )
                        .join("")}
                    </div>
                  </div>
                  `
                    : `
                  <div class="action-editor">
                    <button class="btn" data-act="add-table" data-si="${si}" data-sj="${sj}">+ إنشاء جدول</button>
                  </div>
                  `
                }
              </div>
            </details>

            <div class="action-editor">
              <button class="btn danger" data-act="del-sub" data-si="${si}" data-sj="${sj}">حذف العنوان الفرعي</button>
            </div>
          `;
          subsWrap.appendChild(subDiv);
        });

        host.appendChild(card);
      });
    }

    // ===== المهمات =====
    function rGoals() {
      const host = document.getElementById("goalsEditor");
      host.innerHTML = "";
      (data.goals || []).forEach((g, gi) => {
        const card = document.createElement("div");
        card.className = "editor-card";
        const items = g.items || [];
        card.innerHTML = `
          <label>عنوان فقرة المهمات
            <textarea data-gi="${gi}" class="goal-subtitle" rows="2">${esc(
          g.subtitle || ""
        )}</textarea>
          </label>
          <div class="items">
            ${items
              .map(
                (it, ii) => `
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
            `
              )
              .join("")}
          </div>
          <div class="action-editor">
            <button class="btn" data-act="add-item" data-gi="${gi}">+ إضافة هدف</button>
            <button class="btn danger" data-act="del-group" data-gi="${gi}">حذف فقرة المهمات</button>
          </div>
        `;
        host.appendChild(card);
      });
    }

    // أول رسم
    rSec();
    rGoals();

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
        rSec();
      }
      if (a === "del-col") {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        const sub = data.sections[si].subsections[sj];
        if (sub.table.headers.length) sub.table.headers.pop();
        (sub.table.rows || []).forEach((r) => r.pop());
        if (sub.table.footer && sub.table.footer.length) sub.table.footer.pop();
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

      // Goals
      if (a === "add-item") {
        const gi = +e.target.dataset.gi;
        data.goals[gi].items = data.goals[gi].items || [];
        data.goals[gi].items.push({ title: "", done: false });
        rGoals();
      }
      if (a === "del-item") {
        const gi = +e.target.dataset.gi,
          ii = +e.target.dataset.ii;
        data.goals[gi].items.splice(ii, 1);
        rGoals();
      }
      if (a === "del-group") {
        const gi = +e.target.dataset.gi;
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

    // ====== استيراد JSON (زر + إدخال ملف) ======
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

        // تأكيد: دمج أم استبدال؟
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

        // تعبئة حقول Landing
        document.getElementById("landLogo").value = data.landing?.logo || "";
        document.getElementById("landTitle").value = data.landing?.title || "";
        document.getElementById("landSubtitle").value =
          data.landing?.subtitle || "";
        document.getElementById("landBody").value = data.landing?.body || "";

        // إعادة رسم
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

    // ====== (اختياري) سحب وإفلات ملف JSON على اللوحة ======
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
      importInput.files = e.dataTransfer.files; // أعد استخدام نفس المعالج
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
