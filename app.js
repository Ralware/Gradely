const GRADING_SCALE = [
  { min: 90, grade: "S", points: 10 },
  { min: 79, grade: "A", points: 9 },
  { min: 68, grade: "B", points: 8 },
  { min: 57, grade: "C", points: 7 },
  { min: 46, grade: "D", points: 6 },
  { min: 35, grade: "E", points: 5 },
  { min: 0, grade: "F", points: 0 },
];

const STORAGE_KEY = "gradely-state-v3";
const LEGACY_KEYS = ["gradely-state-v2", "gradely-state-v1"];

let semesters = [];
let seq = 1;

function uid(prefix) {
  return `${prefix}-${Date.now()}-${seq++}-${Math.floor(Math.random() * 1e6)}`;
}

function marksToGrade(marks) {
  if (marks === "" || marks === null || marks === undefined) return null;
  const m = Number(marks);
  if (!Number.isFinite(m) || m < 0 || m > 100) return null;
  for (const row of GRADING_SCALE) {
    if (m >= row.min) return { grade: row.grade, points: row.points };
  }
  return null;
}

function createEmptySemester(index) {
  return {
    id: uid("sem"),
    name: `Semester ${index}`,
    subjects: [],
  };
}

function validCredits(value) {
  const c = Number(value);
  if (!Number.isFinite(c) || c <= 0) return null;
  return c;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(semesters));
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  } catch (_) {}
}

function sanitizeState(parsed) {
  if (!Array.isArray(parsed)) return null;
  const sems = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const name = typeof raw.name === "string" ? raw.name.slice(0, 80) : "";
    const subs = Array.isArray(raw.subjects) ? raw.subjects : [];
    const cleanSubs = [];
    for (const r of subs) {
      if (!r || typeof r !== "object") continue;
      const nm = typeof r.name === "string" ? r.name.slice(0, 120) : "";
      const cr = r.credits === "" || r.credits === null || r.credits === undefined ? "" : r.credits;
      const mk = r.marks === "" || r.marks === null || r.marks === undefined ? "" : r.marks;
      if (nm.trim() === "" && String(cr) === "" && String(mk) === "") continue;
      cleanSubs.push({
        id: typeof r.id === "string" ? r.id : uid("sub"),
        name: nm,
        credits: cr,
        marks: mk,
      });
    }
    sems.push({
      id: typeof raw.id === "string" ? raw.id : uid("sem"),
      name,
      subjects: cleanSubs,
    });
  }
  return sems;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = sanitizeState(JSON.parse(raw));
      if (parsed) semesters = parsed;
      return;
    }
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const parsed = sanitizeState(JSON.parse(legacy));
      if (parsed) {
        semesters = parsed;
        save();
      }
      try { localStorage.removeItem(key); } catch (_) {}
      return;
    }
  } catch (_) {
    semesters = [];
  }
}

function semesterStats(sem) {
  let totalCredits = 0;
  let gradedCredits = 0;
  let weighted = 0;
  let gradedCount = 0;

  for (const s of sem.subjects) {
    const c = validCredits(s.credits);
    if (c !== null) totalCredits += c;
    const g = marksToGrade(s.marks);
    if (g !== null && c !== null) {
      gradedCredits += c;
      weighted += c * g.points;
      gradedCount += 1;
    }
  }

  const sgpa = gradedCredits > 0 ? weighted / gradedCredits : null;
  return { totalCredits, gradedCredits, weighted, gradedCount, totalSubjects: sem.subjects.length, sgpa };
}

function overallStats() {
  let credits = 0;
  let weighted = 0;
  let semCount = 0;
  for (const sem of semesters) {
    const st = semesterStats(sem);
    if (st.sgpa !== null) {
      credits += st.gradedCredits;
      weighted += st.weighted;
      semCount += 1;
    }
  }
  return { credits, weighted, cgpa: credits > 0 ? weighted / credits : null, semCount };
}

function fmt(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function gradeHtml(g) {
  return g ? `<span class="grade grade-${g.grade}">${g.grade}</span>` : `<span class="grade-empty">—</span>`;
}

function sgpaHtml(st) {
  return st.sgpa !== null
    ? `<span class="dl">SGPA</span><strong class="dv">${fmt(st.sgpa)}</strong>`
    : `<span class="dl">SGPA</span><strong class="dv dim">—</strong>`;
}

const welcomeView = document.getElementById("welcome-view");
const semestersView = document.getElementById("semesters-view");
const semestersEl = document.getElementById("semesters");
const infoSemester = document.getElementById("info-semester");
const infoCredits = document.getElementById("info-credits");
const infoCgpa = document.getElementById("info-cgpa");
const historyBody = document.getElementById("history-body");
const historyCgpa = document.getElementById("history-cgpa");

function render() {
  const hasData = semesters.length > 0;
  welcomeView.hidden = hasData;
  semestersView.hidden = !hasData;

  semestersEl.innerHTML = "";
  semesters.forEach((sem, i) => {
    semestersEl.appendChild(renderSemester(sem, i));
  });

  renderInfoBar();
  renderHistory();
}

function renderInfoBar() {
  const overall = overallStats();
  const totalCredits = semesters.reduce((a, s) => a + semesterStats(s).totalCredits, 0);
  infoSemester.textContent = String(semesters.length);
  infoCredits.textContent = String(Math.round(totalCredits * 100) / 100);
  infoCgpa.textContent = overall.cgpa !== null ? fmt(overall.cgpa) : "—";
}

function renderSemester(sem, index) {
  const st = semesterStats(sem);
  const card = document.createElement("div");
  card.className = "sem-card";
  card.dataset.semId = sem.id;

  const rows = sem.subjects.map((s) => {
    const g = marksToGrade(s.marks);
    const c = validCredits(s.credits);
    const weighted = g !== null && c !== null ? c * g.points : null;
    return `
      <tr data-sub-id="${s.id}">
        <td data-label="SUBJECT"><input class="name-input" type="text" placeholder="Subject" value="${esc(s.name)}" aria-label="Subject name" /></td>
        <td data-label="CREDITS"><input class="credits-input" type="number" min="0.5" step="0.5" placeholder="Credits" value="${esc(s.credits)}" aria-label="Credits" /></td>
        <td data-label="MARKS"><input class="marks-input" type="number" min="0" max="100" step="0.5" placeholder="Marks" value="${esc(s.marks)}" aria-label="Marks out of 100" /></td>
        <td data-label="GRADE" class="js-grade">${gradeHtml(g)}</td>
        <td data-label="POINTS" class="num js-points">${g ? g.points : "—"}</td>
        <td data-label="WEIGHTED" class="num js-weighted">${weighted !== null ? weighted : "—"}</td>
        <td class="cell-action"><button class="btn btn-row-del btn-del-sub" type="button" title="Delete subject" aria-label="Delete subject">×</button></td>
      </tr>`;
  }).join("");

  const sgpa = sgpaHtml(st);
  const label = `SEMESTER ${index + 1}`;

  const bodyHtml = sem.subjects.length === 0
    ? `<div class="empty-subjects"><span class="rl">NO SUBJECTS</span><button class="btn btn-secondary btn-xs btn-add-sub" type="button">+ ADD SUBJECT</button></div>`
    : `<div class="table-wrap">
      <table class="data-table subject-table">
        <thead>
          <tr><th>SUBJECT</th><th>CREDITS</th><th>MARKS</th><th>GRADE</th><th>POINTS</th><th>WEIGHTED</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  card.innerHTML = `
    <div class="sem-top">
      <div class="sem-heading">
        <span class="mono faint sem-pos">${label}</span>
        <input class="sem-name" type="text" value="${esc(sem.name)}" aria-label="Semester name" />
      </div>
      <span class="sem-sgpa">${sgpa}</span>
    </div>
    ${bodyHtml}
    <div class="sem-foot">
      <span class="sem-meta">TOTAL CREDITS <strong class="js-total">${st.totalCredits}</strong></span>
      <span class="sem-meta">WEIGHTED POINTS <strong class="js-weighted">${st.weighted}</strong></span>
      <span class="sem-actions">
        <button class="btn btn-secondary btn-xs btn-add-sub" type="button">+ ADD SUBJECT</button>
        <button class="btn btn-danger-ghost btn-xs btn-del-sem" type="button">DELETE</button>
      </span>
    </div>`;

  return card;
}

function renderHistory() {  historyBody.innerHTML = semesters.map((sem, i) => {
    const st = semesterStats(sem);
    return `<tr><td>${i + 1} - ${esc(sem.name || "")}</td><td class="num">${st.totalCredits}</td><td class="num">${st.sgpa !== null ? fmt(st.sgpa) : "-"}</td></tr>`;
  }).join("") || `<tr><td colspan="3" class="faint">NO SEMESTERS RECORDED.</td></tr>`;
  const overall = overallStats();
  historyCgpa.textContent = overall.cgpa !== null ? `${fmt(overall.cgpa)}` : "—";
}

function renderGradeTable() {
  const body = document.getElementById("grade-body");
  body.innerHTML = GRADING_SCALE.map((row, i) => {
    const nextMin = GRADING_SCALE[i - 1]?.min;
    let range;
    if (i === 0) range = `${row.min}–100`;
    else if (i === GRADING_SCALE.length - 1) range = `Below ${nextMin}`;
    else range = `${row.min}–${nextMin - 1}`;
    return `<tr><td>${range}</td><td><span class="grade grade-${row.grade}">${row.grade}</span></td><td>${row.points}</td></tr>`;
  }).join("");
}

function refreshDerived() {
  for (const sem of semesters) {
    const card = semestersEl.querySelector(`[data-sem-id="${sem.id}"]`);
    if (!card) continue;
    const st = semesterStats(sem);
    for (const s of sem.subjects) {
      const row = card.querySelector(`[data-sub-id="${s.id}"]`);
      if (!row) continue;
      const g = marksToGrade(s.marks);
      const c = validCredits(s.credits);
      const weighted = g !== null && c !== null ? c * g.points : null;
      row.querySelector(".js-grade").innerHTML = gradeHtml(g);
      row.querySelector(".js-points").textContent = g ? g.points : "—";
      row.querySelector(".js-weighted").textContent = weighted !== null ? weighted : "—";
    }
    card.querySelector(".sem-sgpa").innerHTML = sgpaHtml(st);
    card.querySelector(".sem-foot .js-total").textContent = st.totalCredits;
    card.querySelector(".sem-foot .js-weighted").textContent = st.weighted;
  }
  renderInfoBar();
  renderHistory();
}

function toast(msg) {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  root.appendChild(el);
  window.setTimeout(() => {
    el.style.opacity = "0";
    window.setTimeout(() => el.remove(), 220);
  }, 2400);
}

function afterChange(msg) {
  save();
  render();
  if (msg) toast(msg);
}

function addSemester() {
  semesters.push(createEmptySemester(semesters.length + 1));
  afterChange("Semester added");
}

function findSemester(card) {
  return semesters.find((x) => x.id === card.dataset.semId);
}

function addSubject(sem) {
  sem.subjects.push({ id: uid("sub"), name: "", credits: "", marks: "" });
  save();
  render();
}

function deleteSubject(sem, subId) {
  sem.subjects = sem.subjects.filter((x) => x.id !== subId);
  save();
  render();
  toast("Subject removed");
}

function deleteSemester(semId) {
  semesters = semesters.filter((x) => x.id !== semId);
  afterChange("Semester removed");
}

function resetAll() {
  semesters = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  } catch (_) {}
  save();
  render();
  toast("Data cleared");
}

function exportData() {
  const blob = new Blob([JSON.stringify(semesters, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "gradely-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Export complete");
}

function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = sanitizeState(JSON.parse(r.result));
      if (!parsed) throw new Error("bad file");
      semesters = parsed;
      afterChange("Import complete");
    } catch (_) {
      toast("Import failed");
    }
  };
  r.readAsText(file);
}

document.getElementById("btn-scratch").addEventListener("click", addSemester);
document.getElementById("btn-add-semester").addEventListener("click", addSemester);
document.getElementById("btn-add-semester-2").addEventListener("click", addSemester);

const backdrop = document.getElementById("modal-backdrop");
document.getElementById("btn-reset").addEventListener("click", () => {
  if (semesters.length === 0) return;
  backdrop.hidden = false;
});
document.getElementById("modal-cancel").addEventListener("click", () => {
  backdrop.hidden = true;
});
backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) backdrop.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") backdrop.hidden = true;
});
document.getElementById("modal-confirm").addEventListener("click", () => {
  backdrop.hidden = true;
  resetAll();
});

document.getElementById("btn-export").addEventListener("click", exportData);
document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("file-import").click();
});
document.getElementById("file-import").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  importData(f);
  e.target.value = "";
});

semestersEl.addEventListener("input", (e) => {
  const row = e.target.closest("tr[data-sub-id]");
  const card = e.target.closest("[data-sem-id]");
  if (!card) return;
  const sem = findSemester(card);
  if (!sem) return;

  if (e.target.classList.contains("sem-name")) {
    sem.name = e.target.value;
  } else if (row) {
    const sub = sem.subjects.find((x) => x.id === row.dataset.subId);
    if (!sub) return;
    if (e.target.classList.contains("name-input")) sub.name = e.target.value;
    if (e.target.classList.contains("credits-input")) sub.credits = e.target.value;
    if (e.target.classList.contains("marks-input")) sub.marks = e.target.value;
  }
  save();
  refreshDerived();
});

semestersEl.addEventListener("click", (e) => {
  const card = e.target.closest("[data-sem-id]");
  if (!card) return;
  const sem = findSemester(card);
  if (!sem) return;

  if (e.target.classList.contains("btn-add-sub")) {
    addSubject(sem);
  } else if (e.target.classList.contains("btn-del-sub")) {
    const row = e.target.closest("tr[data-sub-id]");
    if (!row) return;
    deleteSubject(sem, row.dataset.subId);
  } else if (e.target.classList.contains("btn-del-sem")) {
    deleteSemester(sem.id);
  }
});

window.Gradely = { GRADING_SCALE, marksToGrade, semesterStats };

load();
render();
renderGradeTable();
