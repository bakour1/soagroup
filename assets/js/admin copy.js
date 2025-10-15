// assets/js/admin.js .... مشكلة
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

    // ===== حفظ حالة الفتح للـ details بين إعادة الرسم =====
    const openState = {
      sections: {}, // section index -> boolean (open)
      subsections: {}, // "si:sj" -> boolean
      goals: {}, // goal index -> boolean
    };

    function captureOpenState() {
      // Sections
      document
        .querySelectorAll("#sectionsEditor .editor-card details")
        .forEach((d) => {
          const secInput = d.querySelector(".sec-title");
          const si = secInput ? Number(secInput.dataset.si) : NaN;
          if (!Number.isNaN(si)) {
            openState.sections[si] = !!d.open;
          }
          // subsections
          d.querySelectorAll(".sub-editor details").forEach((sd) => {
            const subInput = sd
              .closest(".sub-editor")
              ?.querySelector(".sub-title");
            const sj = subInput ? Number(subInput.dataset.sj) : NaN;
            if (!Number.isNaN(si) && !Number.isNaN(sj)) {
              openState.subsections[`${si}:${sj}`] = !!sd.open;
            }
          });
        });

      // Goals
      document
        .querySelectorAll("#goalsEditor .editor-card details")
        .forEach((d) => {
          const giElem = d.querySelector(".goal-subtitle");
          const gi = giElem ? Number(giElem.dataset.gi) : NaN;
          if (!Number.isNaN(gi)) {
            openState.goals[gi] = !!d.open;
          }
        });
    }

    function setArrow(det) {
      const arrow = det.querySelector(".arrow");
      if (!arrow) return;
      if (det.open) {
        arrow.textContent = "▾";
        arrow.style.transform = "rotate(90deg)";
      } else {
        arrow.textContent = "▸";
        arrow.style.transform = "rotate(0deg)";
      }
    }

    // ===== الأقسام (مع سهم دوّار وتدرجات) =====
    function rSec() {
      // التقط الحالة الحالية قبل إعادة البناء
      try {
        captureOpenState();
      } catch (e) {
        /* ignore */
      }

      const host = document.getElementById("sectionsEditor");
      host.innerHTML = "";
      (data.sections || []).forEach((s, si) => {
        const cardWrap = document.createElement("div");
        cardWrap.className = "editor-card";

        const det = document.createElement("details");
        // استعادة حالة الفتح إذا مخزنة، وإلا افتح حسب شرط افتراضي
        if (openState.sections.hasOwnProperty(si)) {
          det.open = !!openState.sections[si];
        } else {
          det.open = !s.title || (s.subsections || []).length === 0;
        }

        // summary مع سهم (span.arrow) + عنوان
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

        // عند toggle حدّث السهم والحالة المخزنة
        det.addEventListener("toggle", () => {
          setArrow(det);
          openState.sections[si] = !!det.open;
        });

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

          const inner = document.createElement("div");
          inner.innerHTML = `
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
      `;
          subDiv.appendChild(inner);

          // جدول (إذا موجود) ننشئه داخل details منفصل
          if (hasTable) {
            const sd = document.createElement("details");
            // استعادة حالة الفتح للـ subsection
            const key = `${si}:${sj}`;
            if (openState.subsections.hasOwnProperty(key)) {
              sd.open = !!openState.subsections[key];
            } else {
              sd.open = hasTable; // افتح إذا يوجد جدول افتراضياً
            }

            const ssummary = document.createElement("summary");
            ssummary.textContent = "جدول (اختياري)";
            sd.appendChild(ssummary);

            const tableEditor = document.createElement("div");
            tableEditor.className = "table-editor";
            tableEditor.setAttribute("data-si", si);
            tableEditor.setAttribute("data-sj", sj);

            // رؤوس الأعمدة
            const headersDiv = document.createElement("div");
            headersDiv.className = "tbl-row";
            headersDiv.innerHTML = `<strong>العناوين (Headers)</strong><div class="tbl-grid tbl-headers"></div><div class="action-editor"><button class="btn" data-act="add-col" data-si="${si}" data-sj="${sj}">+ عمود</button><button class="btn danger" data-act="del-col" data-si="${si}" data-sj="${sj}">حذف آخر عمود</button></div>`;
            const headersGrid = headersDiv.querySelector(".tbl-headers");
            (sub.table.headers || []).forEach((h, ci) => {
              const inp = document.createElement("input");
              inp.className = "tbl-h";
              inp.dataset.si = si;
              inp.dataset.sj = sj;
              inp.dataset.ci = ci;
              inp.value = h || "";
              headersGrid.appendChild(inp);
            });
            tableEditor.appendChild(headersDiv);

            // colFormats row
            const formatsDiv = document.createElement("div");
            formatsDiv.className = "tbl-row";
            formatsDiv.innerHTML = `<strong>أنواع الأعمدة (colFormats)</strong><div class="tbl-grid tbl-formats"></div>`;
            const fmtGrid = formatsDiv.querySelector(".tbl-formats");
            for (let ci = 0; ci < colsCount; ci++) {
              const sel = document.createElement("select");
              sel.className = "tbl-format";
              sel.dataset.si = si;
              sel.dataset.sj = sj;
              sel.dataset.ci = ci;
              ["text", "number", "currency", "percent"].forEach((val) => {
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent =
                  val === "text"
                    ? "نص"
                    : val === "number"
                    ? "Number"
                    : val === "currency"
                    ? "Currency"
                    : "Percent";
                if (
                  ((sub.table.colFormats || [])[ci] ||
                    (ci === 0 ? "text" : "number")) === val
                )
                  opt.selected = true;
                sel.appendChild(opt);
              });
              fmtGrid.appendChild(sel);
            }
            tableEditor.appendChild(formatsDiv);

            // صفوف الجدول
            const rowsDiv = document.createElement("div");
            rowsDiv.className = "tbl-row";
            rowsDiv.innerHTML = `<strong>الصفوف (Rows)</strong><div class="tbl-rows"></div><div class="action-editor"><button class="btn" data-act="add-row" data-si="${si}" data-sj="${sj}">+ صف</button><button class="btn danger" data-act="del-table" data-si="${si}" data-sj="${sj}">حذف الجدول</button></div>`;
            const tblRowsContainer = rowsDiv.querySelector(".tbl-rows");
            (sub.table.rows || []).forEach((row, ri) => {
              const rowGrid = document.createElement("div");
              rowGrid.className = "tbl-grid";
              for (let ci = 0; ci < colsCount; ci++) {
                const cell = document.createElement("input");
                cell.className = "tbl-cell";
                cell.dataset.si = si;
                cell.dataset.sj = sj;
                cell.dataset.ri = ri;
                cell.dataset.ci = ci;
                cell.value = row?.[ci] ?? "";
                rowGrid.appendChild(cell);
              }
              const delBtn = document.createElement("button");
              delBtn.className = "btn danger";
              delBtn.dataset.act = "del-row";
              delBtn.dataset.si = si;
              delBtn.dataset.sj = sj;
              delBtn.dataset.ri = ri;
              delBtn.textContent = "حذف الصف";
              rowGrid.appendChild(delBtn);
              tblRowsContainer.appendChild(rowGrid);
            });
            tableEditor.appendChild(rowsDiv);

            // Footer toggle وحقول الفوتر
            const footerRow = document.createElement("div");
            footerRow.className = "tbl-row";
            const chkWrap = document.createElement("label");
            chkWrap.className = "switch";
            chkWrap.innerHTML = `<input type="checkbox" class="tbl-has-footer" data-si="${si}" data-sj="${sj}" ${
              sub.table.footer && sub.table.footer.length ? "checked" : ""
            }/><span>تفعيل صف الفوتر (Footer)</span>`;
            footerRow.appendChild(chkWrap);

            const footGrid = document.createElement("div");
            footGrid.className = "tbl-grid tbl-footer";
            if (!(sub.table.footer && sub.table.footer.length))
              footGrid.style.display = "none";
            for (let ci = 0; ci < colsCount; ci++) {
              const finp = document.createElement("input");
              finp.className = "tbl-f";
              finp.dataset.si = si;
              finp.dataset.sj = sj;
              finp.dataset.ci = ci;
              finp.value = (sub.table.footer && sub.table.footer[ci]) || "";
              footGrid.appendChild(finp);
            }
            tableEditor.appendChild(footerRow);
            tableEditor.appendChild(footGrid);

            sd.appendChild(tableEditor);

            // عند toggle للـ subsection
            sd.addEventListener("toggle", () => {
              setArrow(sd);
              openState.subsections[`${si}:${sj}`] = !!sd.open;
            });

            // ضع سهم داخل summary للـ sd
            const sdArrow = document.createElement("span");
            sdArrow.className = "arrow";
            sdArrow.style.marginInlineEnd = "8px";
            const sdSummary = sd.querySelector("summary");
            if (sdSummary) {
              sdSummary.prepend(sdArrow);
            }

            subDiv.appendChild(sd);
            // ضف subDiv إلى subsWrap
            subsWrap.appendChild(subDiv);

            // اضبط السهم مبدئياً
            setArrow(sd);
          } else {
            // لا جدول: ببساطة أدخل محتوى مع زر إضافة جدول
            const detailsPlaceholder = document.createElement("div");
            detailsPlaceholder.className = "table-editor";
            detailsPlaceholder.innerHTML = `<div class="action-editor"><button class="btn" data-act="add-table" data-si="${si}" data-sj="${sj}">+ إنشاء جدول</button></div>`;
            subDiv.appendChild(detailsPlaceholder);
            subsWrap.appendChild(subDiv);
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

        // ضع سهم داخل summary للـ section
        setArrow(det);
        cardWrap.appendChild(det);
        host.appendChild(cardWrap);
      });
    }

    // ===== المهمات (مع سهم دوّار وتدرجات) =====
    function rGoals() {
      try {
        captureOpenState();
      } catch (e) {
        /* ignore */
      }

      const host = document.getElementById("goalsEditor");
      host.innerHTML = "";
      (data.goals || []).forEach((g, gi) => {
        const cardWrap = document.createElement("div");
        cardWrap.className = "editor-card";

        const det = document.createElement("details");
        if (openState.goals.hasOwnProperty(gi)) {
          det.open = !!openState.goals[gi];
        } else {
          det.open = !g.subtitle || (g.items || []).length < 2;
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

        det.addEventListener("toggle", () => {
          setArrow(det);
          openState.goals[gi] = !!det.open;
        });

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

        // اضبط السهم مبدئياً
        setArrow(det);
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
      if (t.classList.contains("tbl-format")) {
        const si = +t.dataset.si,
          sj = +t.dataset.sj,
          ci = +t.dataset.ci;
        const sub = data.sections[si].subsections[sj];
        const cols = sub.table.headers.length;
        // جهّز المصفوفة بطول الأعمدة
        sub.table.colFormats = Array.from(
          { length: cols },
          (_, i) =>
            (sub.table.colFormats && sub.table.colFormats[i]) ||
            (i === 0 ? "text" : "number")
        );
        sub.table.colFormats[ci] = t.value; // set
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
