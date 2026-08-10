import OpenAI from "openai";

// Connect Atlas to OpenAI using the secret key stored in Netlify.
// The key itself NEVER goes into this file.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// These headers allow the BodyForge website to communicate
// with this Netlify function.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper function for sending JSON responses back to BodyForge.
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// Cleans text before it is sent to Atlas.
// This prevents excessively large or malformed text inputs.
function cleanString(value, maxLength = 5000) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .slice(0, maxLength);
}

export default async function handler(request) {
  // Browsers may send this small request before the real POST request.
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Atlas should only accept POST requests.
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed. Use POST." },
      405
    );
  }

  // Make sure Netlify has access to our secret OpenAI API key.
  if (!process.env.OPENAI_API_KEY) {
    return jsonResponse(
      { error: "OPENAI_API_KEY is not configured." },
      500
    );
  }

  try {
    // Read the information sent by the BodyForge dashboard.
    const body = await request.json();
    const intake = body?.intake;

    // Make sure an intake was actually supplied.
    if (!intake || typeof intake !== "object") {
      return jsonResponse(
        { error: "A valid intake object is required." },
        400
      );
    }

        // Keep only the fields Atlas needs and normalize them into strings.
    const sanitizedIntake = {
      name: cleanString(
        `${intake.first_name ?? ""} ${intake.last_name ?? ""}`.trim(),
        200
      ),

      primary_goal: cleanString(intake.primary_goal, 5000),

      secondary_goals: Array.isArray(intake.secondary_goals)
        ? intake.secondary_goals.slice(0, 20)
        : [],

      training_experience: cleanString(
        intake.training_experience,
        2000
      ),

      availability:
        intake.weekly_availability &&
        typeof intake.weekly_availability === "object"
          ? intake.weekly_availability
          : {},

      preferred_training_location: cleanString(
        intake.preferred_training_location,
        1000
      ),

      medical_conditions: Array.isArray(intake.medical_conditions)
        ? intake.medical_conditions.slice(0, 30)
        : [],

      medications: Array.isArray(intake.medications)
        ? intake.medications.slice(0, 30)
        : [],

      injuries_or_limitations: Array.isArray(
        intake.injuries_or_limitations
      )
        ? intake.injuries_or_limitations.slice(0, 30)
        : [],

      physician_clearance_required:
        intake.physician_clearance_required === true,

      source: cleanString(intake.source, 500),

      referral_detail: cleanString(
        intake.referral_detail,
        1000
      ),

      review_notes: cleanString(
        intake.review_notes,
        3000
      ),
    };

        const atlasInstructions = `
You are Atlas, the internal coaching-intelligence assistant for Big Sky BodyForge.

Your job is to help a certified personal trainer understand a new client intake quickly and safely.

You must:
- summarize the most important coaching information,
- identify possible limitations or concerns that deserve review,
- identify missing information,
- suggest consultation questions,
- suggest reasonable next actions,
- explain the evidence behind your conclusions.

You must NOT:
- diagnose medical conditions,
- claim someone is medically cleared to exercise,
- invent information,
- present uncertain conclusions as facts,
- replace the judgment of a qualified trainer or healthcare professional.

Use cautious language such as:
- "the client reported..."
- "this may warrant clarification..."
- "consider reviewing..."
- "possible limitation..."
- "based on the information provided..."

The readiness score is NOT a medical clearance score.
It represents how complete, understandable, and actionable the intake is for coaching purposes.

The confidence score represents how confident you are in the analysis based only on the quality and completeness of the intake information.

All recommendations are suggestions for the trainer to review.
`;

        // Ask Atlas to return a predictable JSON report.
    const structuredResponse = await openai.responses.create({
      model: "gpt-5-mini",
      store: false,

      instructions: atlasInstructions,

      input: JSON.stringify(sanitizedIntake, null, 2),

      text: {
        format: {
          type: "json_schema",
          name: "bodyforge_intake_analysis",
          strict: true,

          schema: {
            type: "object",
            additionalProperties: false,

            properties: {
              readiness_score: {
                type: "integer",
                minimum: 0,
                maximum: 100,
              },

              confidence_score: {
                type: "integer",
                minimum: 0,
                maximum: 100,
              },

              primary_goal: {
                type: "string",
              },

              summary: {
                type: "string",
              },

              risk_flags: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,

                  properties: {
                    title: { type: "string" },

                    severity: {
                      type: "string",
                      enum: ["low", "moderate", "high"],
                    },

                    reason: { type: "string" },

                    evidence: { type: "string" },
                  },

                  required: [
                    "title",
                    "severity",
                    "reason",
                    "evidence",
                  ],
                },
              },

              missing_information: {
                type: "array",
                items: { type: "string" },
              },

              consultation_questions: {
                type: "array",
                items: { type: "string" },
              },

              recommended_actions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,

                  properties: {
                    action: { type: "string" },

                    reason: { type: "string" },

                    priority: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                  },

                  required: [
                    "action",
                    "reason",
                    "priority",
                  ],
                },
              },

              training_considerations: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,

                  properties: {
                    observation: { type: "string" },

                    reason: { type: "string" },

                    confidence: {
                      type: "integer",
                      minimum: 0,
                      maximum: 100,
                    },
                  },

                  required: [
                    "observation",
                    "reason",
                    "confidence",
                  ],
                },
              },

              evidence: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,

                  properties: {
                    finding: { type: "string" },
                    source: { type: "string" },
                  },

                  required: [
                    "finding",
                    "source",
                  ],
                },
              },
            },

            required: [
              "readiness_score",
              "confidence_score",
              "primary_goal",
              "summary",
              "risk_flags",
              "missing_information",
              "consultation_questions",
              "recommended_actions",
              "training_considerations",
              "evidence",
            ],
          },
        },
      },
    });

        const analysis = JSON.parse(structuredResponse.output_text);

    return jsonResponse({
      success: true,
      model: structuredResponse.model ?? "gpt-5-mini",
      analysis,
    });

  } catch (error) {
    console.error("Atlas intake analysis failed:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Atlas analysis failed.",
      },
      500
    );
  }
}