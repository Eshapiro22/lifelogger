// Call content, derived from the Outbound Prospecting Playbook (30MPC + UYSP).
// Edit freely: pains should be in the buyer's words, not marketing language.
// Tokens: {first} {rep} {org} {company} {industry} {trigger} {lastTouch}
//         {personaPlural} {pain1} {pain2} {gap} {proof}

const PLAYBOOK = {
  personas: {
    cio: {
      label: "CIO / CTO / CDO",
      plural: "IT and data leaders",
      titleKeywords: ["cio", "cto", "cdo", "chief information", "chief technology", "chief data", "chief digital", "vp it", "vp of it", "head of it", "technology"],
      pains: [
        "AI projects that look great in a pilot but never make it to production",
        "nobody's quite sure who governs the agents and bots already running",
        "too many overlapping tools, and the maintenance bill keeps climbing",
      ],
      gap: "getting from RPA to agents without adding another tool to govern",
      discovery: [
        "How many AI pilots are live today vs. actually in production?",
        "Who owns governance for agents and bots right now?",
        "What does it cost you each year just to keep existing automations running?",
      ],
    },
    finops: {
      label: "VP/Dir Finance Ops, Shared Services",
      plural: "finance ops leaders",
      titleKeywords: ["finance", "accounts payable", "ap ", "controller", "shared services", "accounting", "procure", "treasury", "cfo"],
      pains: [
        "invoice volume is growing faster than the team",
        "exceptions like PO mismatches and missing receipts are eating the team's week",
        "the month-end close still takes too many manual days",
      ],
      gap: "the exceptions the current bots can't handle and still land on people",
      discovery: [
        "Walk me through what happens today when an invoice doesn't match the PO.",
        "How many days does close take right now, and where does it stall?",
        "If volume grows 20% next year, is the plan to hire?",
      ],
    },
    coe: {
      label: "Head of Automation / CoE Lead",
      plural: "automation CoE leads",
      titleKeywords: ["automation", "coe", "center of excellence", "rpa", "intelligent", "process excellence", "transformation"],
      pains: [
        "bots breaking every time an app or screen changes",
        "leadership asking for 'agentic' when you're still proving ROI on RPA",
        "a pipeline full of use cases that are too messy for rules-based bots",
      ],
      gap: "scaling past rules-based bots into agentic work without rebuilding everything",
      discovery: [
        "How much of the team's week goes to fixing bots vs. building new ones?",
        "How are you reporting ROI to leadership today?",
        "What's the use case you'd automate tomorrow if the tech could handle it?",
      ],
    },
    qa: {
      label: "VP QA / Engineering",
      plural: "QA and engineering leaders",
      titleKeywords: ["qa", "quality", "test", "engineering", "sdet", "release"],
      pains: [
        "the test backlog grows every sprint",
        "flaky scripts mean nobody trusts the results",
        "releases slip because regression testing takes too long",
      ],
      gap: "test maintenance that eats more time than writing new coverage",
      discovery: [
        "What percentage of regression is automated today?",
        "How often does a release wait on testing?",
        "How much time goes to fixing broken test scripts?",
      ],
    },
    bizline: {
      label: "Business line leader (Claims, Ops, HR)",
      plural: "operations leaders",
      titleKeywords: ["claims", "operations", "ops", "hr", "human resources", "customer", "service", "underwriting", "coo"],
      pains: [
        "backlogs that won't come down no matter how many people you add",
        "SLA misses that land on your desk",
        "customers waiting longer than they should",
      ],
      gap: "the manual steps between systems that still slow the team down",
      discovery: [
        "What does the backlog look like today vs. six months ago?",
        "Where in the process does work sit and wait?",
        "What's the plan if volume keeps growing?",
      ],
    },
  },

  // Openers to rotate. "earn" is the next small yes each one is trying to get.
  openers: [
    {
      id: "permission",
      name: "Permission (30MPC)",
      text: "Hey {first}, it's {rep} from {org}. I know I'm calling out of the blue. Mind if I take 30 seconds to tell you why I called, and then you can tell me if it's worth continuing?",
    },
    {
      id: "honest",
      name: "Honest cold call",
      text: "Hey {first}, {rep} from {org}. Full honesty: this is a cold call. Want to hang up, or give me 30 seconds and then decide?",
    },
    {
      id: "meeting",
      name: "Upfront meeting ask",
      text: "Hey {first}, {rep} from {org}. I'll be upfront: I'm calling to see if it's worth booking a meeting with you. Can I tell you why in 30 seconds, and you tell me if it's a no?",
    },
    {
      id: "tieback",
      name: "Email / LinkedIn tie-back",
      text: "Hey {first}, {rep} from {org}. I sent you a note about {lastTouch} and figured I'd call instead of sending another email. Got 30 seconds?",
      needs: "lastTouch",
    },
    {
      id: "straight",
      name: "Straight to the reason",
      text: "Hey {first}, {rep} with {org}. The reason I'm calling:",
      skipsPermission: true,
    },
  ],

  meetingAsk:
    "Sounds like this may be worth a proper conversation. Open to 30 minutes next week so I can show you how {proof} handled it, and you can decide if it's relevant? … Does Tuesday or Thursday work better?",

  // Acknowledge → Question → Respond → Ask (Playbook 5.5)
  objections: [
    { key: "Not interested", text: "Fair enough, I did call out of the blue. Out of curiosity, is that because it isn't a priority right now, or because you've already got it handled?" },
    { key: "Send me an email", text: "Happy to. So I send something useful rather than a brochure, which is closer: {pain1}, or {pain2}?" },
    { key: "Already use a vendor / UiPath", text: "Makes sense, a lot of the folks I talk to do. Usually the question is {gap}. Is that on your radar at all?" },
    { key: "No budget", text: "Understood. Most people I talk to aren't buying right now. The goal is to see whether it's worth planning for. Is {pain1} something you'd want solved next cycle?" },
    { key: "Bad timing", text: "Totally. When's a better time, and what would need to change for this to be a priority? (Then book it.)" },
    { key: "Who is this?", text: "{rep} from {org}. I know I'm calling out of the blue. (Restate the opener calmly. Don't apologize.)" },
    { key: "How'd you get my number?", text: "Fair question. It's from a business contact database. If you'd rather I not call, I'll take you off my list. Otherwise, can I take 30 seconds on why I called?" },
    { key: "Wrong person", text: "Appreciate you telling me. Who on your team would deal with {pain1}? Mind if I mention you pointed me their way?" },
  ],
};
