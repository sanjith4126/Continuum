// The training-program scoping interview definition -- adapted from
// Scopewright's general software-scoping state machine
// (C:\Users\SANJITH\Desktop\Projects\Scopewright\backend\interview.py) for
// a narrower, training-specific case: a corporate buyer describes a
// learning need, and the interview produces a scoped programme (course
// outline, audience, duration, delivery mode) plus a cost estimate that
// feeds straight into a Continuum quotation.
//
// Same architecture as the original: a state machine with the model
// inside it, not an agent loop. Phases with slots that must fill before
// advancing -- this is what stops the interview wandering. Inferable
// slots are filled by assumption, shown to the buyer to confirm/correct,
// rather than asked -- fewer questions, same as the original's rationale.

export type Slot = { key: string; label: string; required?: boolean; inferable?: boolean };
export type Phase = { key: string; label: string; goal: string; slots: Slot[]; probes: string[] };

export const SCOPING_PHASES: Phase[] = [
  {
    key: "need",
    label: "The business need",
    goal: "Establish what skill or capability gap this training closes, and what it costs the business today. An unquantified need produces an unjustifiable training budget.",
    slots: [
      { key: "skill_gap", label: "What skill or knowledge gap this closes" },
      { key: "business_driver", label: "The business reason this matters now" },
      { key: "cost_of_gap", label: "What the gap costs today (errors, turnover, missed work)", required: false },
      { key: "success_metric", label: "How they'll know the training worked" },
    ],
    probes: [
      "What's going wrong today because this team doesn't have this skill yet?",
      "Why now, specifically -- what changed?",
      "Three months after this training, what would you look at to say it worked?",
    ],
  },
  {
    key: "audience",
    label: "Audience & roles",
    goal: "Enumerate who actually attends, their current skill level, and how many. Cohort size and skill spread drive both curriculum depth and delivery format.",
    slots: [
      { key: "roles", label: "Who attends -- job roles / titles" },
      { key: "headcount", label: "Roughly how many people" },
      { key: "current_level", label: "Their current skill level with this topic" },
      { key: "prior_training", label: "Related training they've already had", required: false, inferable: true },
      { key: "location_spread", label: "One site, multiple sites, or remote", inferable: true },
    ],
    probes: [
      "Is this one team, or people spread across several teams or offices?",
      "Are they starting from zero on this, or do they already know the basics?",
      "Has anyone on this list done similar training before, recently?",
    ],
  },
  {
    key: "curriculum",
    label: "Curriculum scope",
    goal: "Turn the need into a rough syllabus: topics, depth, and whether it's conceptual, hands-on, or both. This is where scope silently doubles if not pinned down.",
    slots: [
      { key: "topics", label: "The topics/modules that must be covered" },
      { key: "hands_on", label: "How much is hands-on practice vs lecture" },
      { key: "assessment", label: "How competency will be checked (quiz, project, certification)", inferable: true },
      { key: "prerequisites", label: "What attendees need to know beforehand", required: false, inferable: true },
    ],
    probes: [
      "Walk me through the topics in the order you'd want them taught.",
      "Should people leave able to explain this, or able to actually do it unsupervised?",
      "Does this need to end in some kind of certificate or sign-off?",
    ],
  },
  {
    key: "logistics",
    label: "Delivery & timeline",
    goal: "Pin down format, duration, and timing constraints -- these are real cost drivers that get assumed away if not asked directly.",
    slots: [
      { key: "delivery_mode", label: "In-person, online live, or self-paced" },
      { key: "duration", label: "Total programme length (days/weeks)" },
      { key: "schedule_constraint", label: "Blackout dates or scheduling constraints", required: false },
      { key: "start_by", label: "When this needs to start" },
    ],
    probes: [
      "Does this need to happen in a room together, or can it be run remotely?",
      "Is this a single intensive block, or spread over several weeks around work?",
      "Is there a date this is tied to -- a launch, an audit, an onboarding cohort?",
    ],
  },
  {
    key: "budget",
    label: "Budget & scope cut",
    goal: "Get a real budget band, and sort what's essential for v1 versus what's a nice-to-have for a later cohort. Anything that doesn't serve the business driver from phase one is a candidate to cut.",
    slots: [
      { key: "budget_band", label: "Rough budget shape" },
      { key: "must_have", label: "What this programme cannot ship without" },
      { key: "phase_two", label: "Real, but fine to add in a later cohort", required: false },
      { key: "decision_maker", label: "Who signs off on this quote" },
    ],
    probes: [
      "What budget range are you working with, roughly?",
      "If you had to cut this programme in half, what stays?",
      "Who needs to say yes before we can schedule this?",
    ],
  },
];

export const PHASE_MAP = new Map(SCOPING_PHASES.map((p) => [p.key, p]));

export function phaseAt(index: number): Phase | null {
  return SCOPING_PHASES[index] ?? null;
}

export function requiredSlots(phase: Phase) {
  return phase.slots.filter((s) => s.required !== false);
}

export function missingRequired(phase: Phase, filled: Record<string, string>) {
  return requiredSlots(phase).filter((s) => !filled[s.key]);
}

export function missingSlots(phase: Phase, filled: Record<string, string>) {
  return phase.slots.filter((s) => !filled[s.key]);
}

export const UNKNOWN_VALUE = "Not known — the buyer could not answer";

const SKIP_PHRASES = ["i don't know", "i dont know", "no idea", "not sure", "can't answer", "cant answer", "skip this", "move on", "next question"];

export function isSkip(message: string): boolean {
  const text = message.toLowerCase().trim();
  if (text.length > 120) return false;
  return SKIP_PHRASES.some((p) => text.includes(p));
}
