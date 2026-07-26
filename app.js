const SUPABASE_URL = "https://hchqwipztvgyttnutnzr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjaHF3aXB6dHZneXR0bnV0bnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMTA2NTksImV4cCI6MjA3Nzg4NjY1OX0.-F8O0saan7IdbDp71JZczrZGA7GepmfuJqTdmwTMU7g";
const ORGANIZATION_SLUG = "big-sky-bodyforge";

const form = document.getElementById("intakeForm");
const steps = [...document.querySelectorAll(".form-step")];
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");
const submitBtn = document.getElementById("submitBtn");
const errorBox = document.getElementById("formError");
const progressBar = document.getElementById("progressBar");
const stepLabel = document.getElementById("stepLabel");
const stepName = document.getElementById("stepName");
const successPanel = document.getElementById("successPanel");
const stepNames = ["Contact", "Goals", "Preferences", "Health", "Consent"];
let currentStep = 0;

document.getElementById("year").textContent = new Date().getFullYear();

function setError(message = "") {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function updateStep() {
  steps.forEach((step, index) => step.classList.toggle("active", index === currentStep));
  backBtn.hidden = currentStep === 0;
  nextBtn.hidden = currentStep === steps.length - 1;
  submitBtn.hidden = currentStep !== steps.length - 1;
  progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  stepLabel.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  stepName.textContent = stepNames[currentStep];
  setError();
  window.scrollTo({ top: document.querySelector(".form-shell").offsetTop - 18, behavior: "smooth" });
}

function validateContact() {
  const email = form.elements.email.value.trim();
  const phone = form.elements.phone.value.trim();
  if (!email && !phone) {
    form.elements.email.classList.add("invalid");
    form.elements.phone.classList.add("invalid");
    setError("Enter at least an email address or phone number.");
    return false;
  }
  return true;
}

function validateCurrentStep() {
  setError();
  const step = steps[currentStep];
  const requiredFields = [...step.querySelectorAll("[required]")];

  for (const field of requiredFields) {
    field.classList.remove("invalid");
    if (!field.checkValidity()) {
      field.classList.add("invalid");
      field.reportValidity();
      return false;
    }
  }

  if (currentStep === 0 && !validateContact()) return false;
  return true;
}

nextBtn.addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  currentStep += 1;
  updateStep();
});

backBtn.addEventListener("click", () => {
  currentStep -= 1;
  updateStep();
});

form.addEventListener("input", (event) => {
  event.target.classList.remove("invalid");
  if (errorBox.textContent) setError();
});

function splitList(value) {
  return value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function checkedValues(name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
}

function formPayload() {
  const availability = checkedValues("availability");
  return {
    p_organization_slug: ORGANIZATION_SLUG,
    p_first_name: form.elements.first_name.value.trim(),
    p_last_name: form.elements.last_name.value.trim(),
    p_email: form.elements.email.value.trim(),
    p_phone: form.elements.phone.value.trim(),
    p_preferred_contact: form.elements.preferred_contact.value,
    p_primary_goal: form.elements.primary_goal.value.trim(),
    p_secondary_goals: checkedValues("secondary_goals"),
    p_target_date: form.elements.target_date.value || null,
    p_training_experience: form.elements.training_experience.value || null,
    p_weekly_availability: { selections: availability },
    p_preferred_training_location: form.elements.preferred_training_location.value || null,
    p_medical_conditions: splitList(form.elements.medical_conditions.value),
    p_medications: splitList(form.elements.medications.value),
    p_injuries_or_limitations: splitList(form.elements.injuries_or_limitations.value),
    p_physician_clearance_required: form.elements.physician_clearance_required.checked,
    p_emergency_contact: {
      name: form.elements.emergency_name.value.trim(),
      phone: form.elements.emergency_phone.value.trim(),
      relationship: form.elements.emergency_relationship.value.trim()
    },
    p_communication_preferences: {
      preferred_contact: form.elements.preferred_contact.value,
      service_messages: form.elements.consent_communications.checked
    },
    p_source: form.elements.source.value || null,
    p_referral_detail: form.elements.referral_detail.value.trim() || null,
    p_signer_name: form.elements.signer_name.value.trim(),
    p_consents: [
      { type: "privacy", accepted: form.elements.consent_privacy.checked, document_version: "1.0" },
      { type: "training_risk", accepted: form.elements.consent_training_risk.checked, document_version: "1.0" },
      { type: "medical_disclosure", accepted: form.elements.consent_medical.checked, document_version: "1.0" },
      { type: "communications", accepted: form.elements.consent_communications.checked, document_version: "1.0" },
      { type: "photo_video", accepted: form.elements.consent_photo.checked, document_version: "1.0" }
    ]
  };
}

async function submitIntake(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_client_intake`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }

  if (!response.ok) {
    const detail = data?.message || data?.details || "The intake could not be submitted.";
    throw new Error(detail);
  }
  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateCurrentStep()) return;

  if (form.elements.website.value) {
    form.reset();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add("loading");
  setError();

  try {
    const intakeId = await submitIntake(formPayload());
    form.hidden = true;
    document.querySelector(".progress-wrap").hidden = true;
    successPanel.hidden = false;

    const shortCode = String(intakeId || "").replaceAll("-", "").slice(0, 10).toUpperCase();
    document.getElementById("confirmationCode").textContent =
      shortCode ? `Confirmation: ${shortCode}` : "Submission confirmed";

    window.scrollTo({ top: document.querySelector(".form-shell").offsetTop - 18, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    setError(error.message || "Something went wrong. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("loading");
  }
});

updateStep();
