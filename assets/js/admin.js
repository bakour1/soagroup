(function () {
  const admin = document.documentElement.getAttribute("data-role") === "admin";
  function dl(n, t) {
    const b = new Blob([t], { type: "application/json;charset=utf-8" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = n;
    a.click();
    URL.revokeObjectURL(u);
  }
  async function openEd() {
    const url = window.currentDataUrl;
    const data = await (await fetch(url + "?v=" + Date.now())).json();
    const p = document.createElement("div");
    p.className = "admin-panel";
    p.innerHTML =
      '<div class="admin-header"><strong>وضع الإدارة</strong><button id="saveJsonBtn" class="btn">تصدير JSON</button><button id="closeAdminBtn" class="btn btn-ghost">إغلاق</button></div><div class="admin-body"><details open><summary>الـ Landing</summary><label>العنوان <input id="landTitle"/></label><label>العنوان الثاني <input id="landSubtitle"/></label><label>النص والشرح <textarea id="landBody"></textarea></label></details><details open><summary>الأقسام والفقرات</summary><div id="sectionsEditor"></div><button id="addSection" class="btn">+ قسم جديد</button></details><details open><summary>المهمات</summary><div id="goalsEditor"></div><button id="addGoalGroup" class="btn">+ فقرة أهداف جديدة</button></details></div>';
    document.body.appendChild(p);
    document.getElementById("landTitle").value = data.landing?.title || "";
    document.getElementById("landSubtitle").value =
      data.landing?.subtitle || "";
    document.getElementById("landBody").value = data.landing?.body || "";
    function rSec() {
      const h = document.getElementById("sectionsEditor");
      h.innerHTML = "";
      (data.sections || []).forEach((s, si) => {
        const w = document.createElement("div");
        w.className = "editor-card";
        w.innerHTML =
          '<label>عنوان القسم <input data-si="' +
          si +
          '" class="sec-title" value="' +
          (s.title || "") +
          '"/></label><div class="subs">' +
          (s.subsections || [])
            .map(
              (sub, sj) =>
                '<div class="sub-editor"><label>عنوان فرعي <input data-si="' +
                si +
                '" data-sj="' +
                sj +
                '" class="sub-title" value="' +
                (sub.subtitle || "") +
                '"/></label><label>النصوص (كل سطر نص)<textarea data-si="' +
                si +
                '" data-sj="' +
                sj +
                '" class="sub-texts">' +
                (sub.texts || []).join("\n") +
                '</textarea></label><button class="btn danger" data-act="del-sub" data-si="' +
                si +
                '" data-sj="' +
                sj +
                '">حذف العنوان الفرعي</button></div>'
            )
            .join("") +
          '</div> <div class="action-editor"><button class="btn" data-act="add-sub" data-si="' +
          si +
          '">+ إضافة عنوان فرعي</button><button class="btn danger" data-act="del-sec" data-si="' +
          si +
          '">حذف القسم</button></div>';
        h.appendChild(w);
      });
    }
    function rGoals() {
      const h = document.getElementById("goalsEditor");
      h.innerHTML = "";
      (data.goals || []).forEach((g, gi) => {
        const w = document.createElement("div");
        w.className = "editor-card";
        w.innerHTML =
          '<label>عنوان فقرة المهمات<textarea  data-gi="' +
          gi +
          '" class="goal-subtitle" rows="2" value="' +
          (g.subtitle || "") +
          '"/></label><div class="items">' +
          (g.items || [])
            .map(
              (it, ii) =>
                '<div class="item-editor">"' +
                gi +
                '" data-ii="' +
                ii +
                '" class="goal-title" value="' +
                (it.title || "") +
                '"/><label class="switch"><input type="checkbox" data-gi="' +
                gi +
                '" data-ii="' +
                ii +
                '" class="goal-done" ' +
                (it.done ? "checked" : "") +
                '/></label><button class="btn danger" data-act="del-item" data-gi="' +
                gi +
                '" data-ii="' +
                ii +
                '">حذف</button></div>'
            )
            .join("") +
          '</div><div class="action-editor"><button class="btn" data-act="add-item" data-gi="' +
          gi +
          '">+ إضافة هدف</button><button class="btn danger" data-act="del-group" data-gi="' +
          gi +
          '">حذف فقرة المهمات</button></div>';
        h.appendChild(w);
      });
    }
    rSec();
    rGoals();
    p.addEventListener("input", (e) => {
      if (e.target.id === "landTitle")
        data.landing = { ...(data.landing || {}), title: e.target.value };
      if (e.target.id === "landSubtitle")
        data.landing = { ...(data.landing || {}), subtitle: e.target.value };
      if (e.target.id === "landBody")
        data.landing = { ...(data.landing || {}), body: e.target.value };
      if (e.target.classList.contains("sec-title")) {
        const si = +e.target.dataset.si;
        data.sections[si].title = e.target.value;
      }
      if (e.target.classList.contains("sub-title")) {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        data.sections[si].subsections[sj].subtitle = e.target.value;
      }
      if (e.target.classList.contains("sub-texts")) {
        const si = +e.target.dataset.si,
          sj = +e.target.dataset.sj;
        data.sections[si].subsections[sj].texts = e.target.value
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean);
      }
      if (e.target.classList.contains("goal-subtitle")) {
        const gi = +e.target.dataset.gi;
        data.goals[gi].subtitle = e.target.value;
      }
      if (e.target.classList.contains("goal-title")) {
        const gi = +e.target.dataset.gi,
          ii = +e.target.dataset.ii;
        data.goals[gi].items[ii].title = e.target.value;
      }
      if (e.target.classList.contains("goal-done")) {
        const gi = +e.target.dataset.gi,
          ii = +e.target.dataset.ii;
        data.goals[gi].items[ii].done = e.target.checked;
      }
    });
    p.addEventListener("click", (e) => {
      const a = e.target.dataset.act;
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
      if (a === "add-item") {
        const gi = +e.target.dataset.gi;
        data.goals[gi].items = data.goals[gi].items || [];
        data.goals[gi].items.push({ title: "هدف جديد", done: false });
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
    p.querySelector("#addSection").onclick = () => {
      data.sections = data.sections || [];
      data.sections.push({ title: "قسم جديد", subsections: [] });
      rSec();
    };
    p.querySelector("#addGoalGroup").onclick = () => {
      data.goals = data.goals || [];
      data.goals.push({ subtitle: "فقرة أهداف جديدة", items: [] });
      rGoals();
    };
    p.querySelector("#saveJsonBtn").onclick = () => {
      const file = (window.currentDataUrl || "data.json").split("/").pop();
      dl(file, JSON.stringify(data, null, 2));
    };
    p.querySelector("#closeAdminBtn").onclick = () => p.remove();
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
