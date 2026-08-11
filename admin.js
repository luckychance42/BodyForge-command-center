const SUPABASE_URL = "https://hchqwipztvgyttnutnzr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjaHF3aXB6dHZneXR0bnV0bnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMTA2NTksImV4cCI6MjA3Nzg4NjY1OX0.-F8O0saan7IdbDp71JZczrZGA7GepmfuJqTdmwTMU7g";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = id => document.getElementById(id);
const state = { user: null, organization: null, intakes: [], consents: [], clients: [], activeIntake: null };

function message(el, text = "", error = false) {
  el.textContent = text;
  el.classList.toggle("error", error);
  el.hidden = !text;
}
function fmtDate(value) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value)) : "—";
}
function esc(value) {
  return String(value ?? "—").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function arrayText(value) {
  return Array.isArray(value) && value.length ? value.join(", ") : "None reported";
}
function jsonText(value) {
  if (!value || Object.keys(value).length === 0) return "None provided";
  return Object.entries(value).filter(([,v]) => v && (!Array.isArray(v) || v.length)).map(([k,v]) =>
    `${k.replaceAll("_"," ")}: ${Array.isArray(v) ? v.join(", ") : v}`
  ).join("\n") || "None provided";
}

async function initialize() {
  const { data: { session } } = await db.auth.getSession();
  if (session) await enterDashboard(session.user);
  else showLogin();
}

function showLogin() {
  $("loginView").hidden = false;
  $("dashboardView").hidden = true;
}
async function enterDashboard(user) {
  state.user = user;
  $("ownerEmail").textContent = user.email || "";
  $("loginView").hidden = true;
  $("dashboardView").hidden = false;
  await loadAll();
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  message($("loginError"));
  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Signing in…";
  const { data, error } = await db.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });
  $("loginBtn").disabled = false;
  $("loginBtn").textContent = "Sign in";
  if (error) return message($("loginError"), error.message, true);
  await enterDashboard(data.user);
});

$("signOutBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  state.user = null;
  showLogin();
});

async function loadAll() {
  $("refreshBtn").disabled = true;
  $("refreshBtn").textContent = "Refreshing…";
  try {
    const { data: orgs, error: orgError } = await db
      .from("organizations")
      .select("id,name,slug,owner_user_id")
      .eq("owner_user_id", state.user.id)
      .limit(1);
    if (orgError) throw orgError;
    if (!orgs?.length) throw new Error("This signed-in account is not the BodyForge organization owner.");
    state.organization = orgs[0];

    const [intakeResult, clientResult] = await Promise.all([
      db.from("intake_submissions").select("*").eq("organization_id", state.organization.id).order("created_at", { ascending:false }),
      db.from("clients").select("*").eq("organization_id", state.organization.id).order("created_at", { ascending:false })
    ]);
    if (intakeResult.error) throw intakeResult.error;
    if (clientResult.error) throw clientResult.error;
    state.intakes = intakeResult.data || [];
    state.clients = clientResult.data || [];

    const ids = state.intakes.map(x => x.id);
    if (ids.length) {
      const consentResult = await db.from("intake_consents").select("*").in("intake_submission_id", ids);
      if (consentResult.error) throw consentResult.error;
      state.consents = consentResult.data || [];
    } else state.consents = [];

    renderStats();
    renderIntakes();
    renderClients();
  } catch (error) {
    console.error(error);
    alert(error.message || "Dashboard data could not be loaded.");
  } finally {
    $("refreshBtn").disabled = false;
    $("refreshBtn").textContent = "Refresh";
  }
}

function renderStats() {
  const count = status => state.intakes.filter(i => i.status === status).length;
  $("submittedCount").textContent = count("submitted");
  $("reviewCount").textContent = count("reviewing") + count("approved");
  $("convertedCount").textContent = count("converted");
  $("clientCount").textContent = state.clients.length;
  $("navIntakeCount").textContent = state.intakes.length;
  $("navClientCount").textContent = state.clients.length;
}

function renderIntakes() {
  const filter = $("statusFilter").value;
  const items = filter === "all" ? state.intakes : state.intakes.filter(i => i.status === filter);
  $("intakeList").innerHTML = items.map(i => `
    <article class="row" data-id="${i.id}">
      <div class="person"><strong>${esc(i.first_name)} ${esc(i.last_name)}</strong><span>${esc(i.primary_goal).slice(0,90)}</span></div>
      <div class="contact">${esc(i.email)}<br><span>${esc(i.phone)}</span></div>
      <span class="badge ${esc(i.status)}">${esc(i.status)}</span>
      <span class="submitted">${fmtDate(i.created_at)}</span>
    </article>`).join("");
  $("intakeEmpty").hidden = items.length > 0;
  document.querySelectorAll("#intakeList .row").forEach(row => row.addEventListener("click", () => openIntake(row.dataset.id)));
}
function renderClients() {
  $("clientList").innerHTML = state.clients.map(c => `
    <article class="row">
      <div class="person"><strong>${esc(c.first_name)} ${esc(c.last_name)}</strong><span>${esc(c.status)}</span></div>
      <div class="contact">${esc(c.email)}<br><span>${esc(c.phone)}</span></div>
      <span class="badge ${esc(c.status)}">${esc(c.status)}</span>
      <span class="submitted">${fmtDate(c.created_at)}</span>
    </article>`).join("");
  $("clientEmpty").hidden = state.clients.length > 0;
}

$("statusFilter").addEventListener("change", renderIntakes);
$("refreshBtn").addEventListener("click", loadAll);

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(x => x.classList.toggle("active", x === btn));
  const showIntakes = btn.dataset.view === "intakes";
  $("intakesView").hidden = !showIntakes;
  $("clientsView").hidden = showIntakes;
  $("pageTitle").textContent = showIntakes ? "Client Intakes" : "Clients";
}));

function detail(label, value, wide=false) {
  return `<div class="detail ${wide ? "wide":""}"><small>${esc(label)}</small><span>${esc(value)}</span></div>`;
}
function openIntake(id) {
  const i = state.intakes.find(x => x.id === id);
  if (!i) return;
  state.activeIntake = i;
  const consents = state.consents.filter(c => c.intake_submission_id === id);
  $("dialogName").textContent = `${i.first_name} ${i.last_name}`;
  $("dialogMeta").textContent = `${i.status} • submitted ${fmtDate(i.created_at)}`;
  $("reviewNotes").value = i.review_notes || "";
  $("convertBtn").disabled = i.status === "converted";
  $("convertBtn").textContent = i.status === "converted" ? "Already converted" : "Convert to client";
  message($("dialogMessage"));

  $("dialogBody").innerHTML = `
    <section class="detail-section"><h3>Contact</h3><div class="detail-grid">
      ${detail("Email", i.email)}${detail("Phone", i.phone)}${detail("Preferred contact", i.preferred_contact)}${detail("Source", i.source)}
    </div></section>
    <section class="detail-section"><h3>Goals and training</h3><div class="detail-grid">
      ${detail("Primary goal", i.primary_goal, true)}
      ${detail("Secondary goals", arrayText(i.secondary_goals), true)}
      ${detail("Target date", i.target_date)}${detail("Experience", i.training_experience)}
      ${detail("Availability", jsonText(i.weekly_availability), true)}
      ${detail("Preferred location", i.preferred_training_location)}
    </div></section>
    <section class="detail-section"><h3>Health and safety</h3><div class="detail-grid">
      ${detail("Medical conditions", arrayText(i.medical_conditions), true)}
      ${detail("Medications", arrayText(i.medications), true)}
      ${detail("Injuries or limitations", arrayText(i.injuries_or_limitations), true)}
      ${detail("Physician clearance flagged", i.physician_clearance_required ? "Yes" : "No")}
      ${detail("Emergency contact", jsonText(i.emergency_contact), true)}
    </div></section>
    <section class="detail-section"><h3>Consents</h3><div class="detail-grid">
      ${consents.map(c => `<div class="detail"><small>${esc(c.consent_type.replaceAll("_"," "))}</small><span class="${c.accepted ? "consent-yes":"consent-no"}">${c.accepted ? "Accepted":"Not accepted"}${c.signer_name ? ` by ${esc(c.signer_name)}`:""}</span></div>`).join("")}
    </div></section>`;
  $("intakeDialog").showModal();
}

$("closeDialog").addEventListener("click", () => $("intakeDialog").close());
$("intakeDialog").addEventListener("click", e => {
  if (e.target === $("intakeDialog")) $("intakeDialog").close();
});

$("saveReviewBtn").addEventListener("click", async () => {
  const i = state.activeIntake;
  if (!i) return;
  $("saveReviewBtn").disabled = true;
  const { error } = await db.from("intake_submissions").update({
    review_notes: $("reviewNotes").value.trim() || null,
    status: i.status === "submitted" ? "reviewing" : i.status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: state.user.id
  }).eq("id", i.id).eq("organization_id", state.organization.id);
  $("saveReviewBtn").disabled = false;
  if (error) return message($("dialogMessage"), error.message, true);
  message($("dialogMessage"), "Review saved.");
  await loadAll();
  state.activeIntake = state.intakes.find(x => x.id === i.id);
});

$("convertBtn").addEventListener("click", async () => {
  const i = state.activeIntake;
  if (!i || i.status === "converted") return;
  if (!confirm(`Convert ${i.first_name} ${i.last_name} into an active client profile?`)) return;
  $("convertBtn").disabled = true;
  $("convertBtn").textContent = "Converting…";
  message($("dialogMessage"));
  const { data, error } = await db.rpc("convert_intake_to_client", { p_intake_id: i.id });
  if (error) {
    $("convertBtn").disabled = false;
    $("convertBtn").textContent = "Convert to client";
    return message($("dialogMessage"), error.message, true);
  }
  message($("dialogMessage"), `Client created successfully. ID: ${String(data).slice(0,8).toUpperCase()}`);
  await loadAll();
  state.activeIntake = state.intakes.find(x => x.id === i.id);
  $("convertBtn").disabled = true;
  $("convertBtn").textContent = "Already converted";
});

$("atlasAnalyzeBtn").addEventListener("click", async () => {
  const intake = state.activeIntake;
  if (!intake) return;

  const btn = $("atlasAnalyzeBtn");

  btn.disabled = true;
  btn.textContent = "Atlas analyzing…";
  message($("dialogMessage"), "Atlas is reviewing this intake…");

  try {
    const response = await fetch("/.netlify/functions/analyze-intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intake,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error || "Atlas could not analyze this intake."
      );
    }

    const a = result.analysis;

    const riskFlags = (a.risk_flags || [])
      .map(flag => `
        <div class="detail wide">
          <small>${esc(flag.severity.toUpperCase())} — ${esc(flag.title)}</small>
          <span>${esc(flag.reason)}</span>
        </div>
      `)
      .join("");

    const questions = (a.consultation_questions || [])
      .map(q => `<li>${esc(q)}</li>`)
      .join("");

    const actions = (a.recommended_actions || [])
      .map(item => `
        <li>
          <strong>${esc(item.action)}</strong>
          — ${esc(item.reason)}
        </li>
      `)
      .join("");

    const training = (a.training_considerations || [])
      .map(item => `
        <li>
          ${esc(item.observation)}
          <small> (${esc(item.confidence)}% confidence)</small>
        </li>
      `)
      .join("");

    const existingAtlas = document.getElementById("atlasAnalysis");
    if (existingAtlas) existingAtlas.remove();

    const atlasSection = document.createElement("section");
    atlasSection.id = "atlasAnalysis";
    atlasSection.className = "detail-section";

    atlasSection.innerHTML = `
      <h3>Atlas Client Intelligence</h3>

      <div class="detail-grid">
        ${detail("Readiness score", `${a.readiness_score}/100`)}
        ${detail("AI confidence", `${a.confidence_score}/100`)}
        ${detail("Primary goal", a.primary_goal, true)}
        ${detail("Atlas summary", a.summary, true)}
      </div>

      <h3>Risk & Review Flags</h3>
      <div class="detail-grid">
        ${riskFlags || detail("Risk flags", "No major flags identified.", true)}
      </div>

      <h3>Consultation Questions</h3>
      <ul>
        ${questions || "<li>No additional questions suggested.</li>"}
      </ul>

      <h3>Recommended Actions</h3>
      <ul>
        ${actions || "<li>No actions suggested.</li>"}
      </ul>

      <h3>Training Considerations</h3>
      <ul>
        ${training || "<li>No additional considerations.</li>"}
      </ul>
    `;

    $("dialogBody").prepend(atlasSection);

    message(
      $("dialogMessage"),
      `Atlas analysis complete. Confidence: ${a.confidence_score}/100.`
    );

  } catch (error) {
    console.error(error);

    message(
      $("dialogMessage"),
      error.message || "Atlas analysis failed.",
      true
    );

  } finally {
    btn.disabled = false;
    btn.textContent = "Analyze with Atlas";
  }
});

db.auth.onAuthStateChange((_event, session) => {
  if (!session && state.user) showLogin();
});
initialize();
