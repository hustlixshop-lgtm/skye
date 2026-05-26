import os
import uuid
import re
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from mistralai import Mistral
from supabase import create_client, Client

# ══════════════════════════════════════════════════════════════════
#  APP SETUP
# ══════════════════════════════════════════════════════════════════
app = FastAPI(
    title="Milo Engine",
    description="Campus gig marketplace AI orchestration — Mistral structured output",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://bjoofaprhadqqrxamrbs.supabase.co")
SUPABASE_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqb29mYXByaGFkcXFyeGFtcmJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MDI3OTQsImV4cCI6MjA5NTA3ODc5NH0.WGmN5_uqFPvS6NhOFGdF41diyzNTbO2v90vFG6lq5Ns",
)
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "DakJZ15kXlCM9otxp28P96D1jqXdBoyK")
mistral_client = Mistral(api_key=MISTRAL_API_KEY)


# ══════════════════════════════════════════════════════════════════
#  REQUEST / RESPONSE MODELS  (fully typed for Swagger UI)
# ══════════════════════════════════════════════════════════════════
class ChatMessagePayload(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text")

    model_config = {
        "json_schema_extra": {
            "examples": [{"role": "user", "content": "I need a tutor for calculus"}]
        }
    }


class PaymentRange(BaseModel):
    min: int = Field(..., description="Minimum pay in USD", example=10)
    max: int = Field(..., description="Maximum pay in USD", example=50)


class UserProfile(BaseModel):
    user_id: str = Field(..., description="Supabase user UUID")
    role: str = Field(..., description="'finder' (posting a gig) or 'worker' (finding a gig)")
    location: str = Field(..., description="User's default campus location")
    max_walk_time_mins: int = Field(..., description="Max acceptable walk time in minutes")
    payment_range: PaymentRange
    skills_interests: List[str] = Field(..., description="User's skills or interests")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "user_id": "8ecb9523-7a91-46ab-8eae-0c670d27cc75",
                    "role": "worker",
                    "location": "Student Union",
                    "max_walk_time_mins": 20,
                    "payment_range": {"min": 15, "max": 40},
                    "skills_interests": ["AP Physics", "Advanced Calculus", "Graphic Design"],
                }
            ]
        }
    }


class ContextualChatPayload(BaseModel):
    session_id: str = Field(..., description="Unique session identifier")
    messages: List[ChatMessagePayload] = Field(
        ..., description="Full conversation history — MUST include all prior turns"
    )
    user_profile: UserProfile

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "session_id": "session-1779768633659",
                    "messages": [
                        {
                            "role": "user",
                            "content": "tutoring, $40/hr, 15 min walk, south campus, find me gigs",
                        }
                    ],
                    "user_profile": {
                        "user_id": "8ecb9523-7a91-46ab-8eae-0c670d27cc75",
                        "role": "worker",
                        "location": "Student Union",
                        "max_walk_time_mins": 20,
                        "payment_range": {"min": 15, "max": 40},
                        "skills_interests": ["AP Physics", "Advanced Calculus", "Graphic Design"],
                    },
                }
            ]
        }
    }


class MatchResult(BaseModel):
    id: str
    matched_user_name: str
    matched_user_id: str
    match_score: int
    title: str
    category: str
    pay_min: int
    pay_max: int
    campus_location: str
    walk_time_mins: int
    description: str
    decision: Optional[str] = None
    escrow_status: str = "pending"


class DirectivePayload(BaseModel):
    action: str = Field(..., description="'fill_param' | 'search_gigs' | 'post_gig'")


class MiloResponse(BaseModel):
    success: bool
    message: str = Field(..., description="Human-readable response from Milo")
    milo_response: str = Field(..., description="Same as message — legacy field for frontend compat")
    matches: List[MatchResult] = Field(default_factory=list)
    awaiting_confirmation: bool = Field(
        False, description="True when Milo has summarised slots and is waiting for user to confirm"
    )
    slots_detected: Dict[str, Any] = Field(
        default_factory=dict, description="Debug — what slots were extracted this turn"
    )
    directive: DirectivePayload


# ══════════════════════════════════════════════════════════════════
#  MISTRAL STRUCTURED OUTPUT SCHEMA
# ══════════════════════════════════════════════════════════════════
class GigSlotTracker(BaseModel):
    """
    Mistral fills this every turn by reading the full conversation history.
    All fields default to None/False so partial extraction is safe.
    """
    extracted_task_or_skill: Optional[str] = Field(
        None,
        description="The core task or skill the user needs, e.g. 'tutoring', 'graphic design', 'moving boxes'",
    )
    extracted_location: Optional[str] = Field(
        None,
        description="Campus location, e.g. 'South Campus', 'Library', 'Main Quad'",
    )
    extracted_pay_max: Optional[int] = Field(
        None,
        description="Maximum pay in USD as an integer, e.g. 40 for '$40/hr' or '$40 flat'",
    )
    extracted_walk_time_mins: Optional[int] = Field(
        None,
        description="Max walking distance in minutes as an integer, e.g. 15",
    )
    extracted_category: Optional[str] = Field(
        None,
        description=(
            "Auto-assigned category — pick the closest match: "
            "'Academic Help' | 'Physical Tasks' | 'Creative Work' | "
            "'Tech Support' | 'Admin' | 'Other'"
        ),
    )
    awaiting_confirmation: bool = Field(
        False,
        description=(
            "Set to True ONLY when ALL four slots are filled and you have just asked "
            "the user to confirm the summary. Do NOT set True before all slots are known."
        ),
    )
    confirmed: bool = Field(
        False,
        description=(
            "Set to True ONLY when the user has explicitly agreed in their latest message "
            "(e.g. 'yes', 'sure', 'go ahead', 'find them', 'ok', 'sounds good', 'do it', 'yep'). "
            "NEVER set True on the same turn you ask for confirmation."
        ),
    )
    slots_fully_complete: bool = Field(
        False,
        description=(
            "Set to True ONLY when confirmed=True AND all four core slots are extracted. "
            "This is what triggers match retrieval. If uncertain, leave False."
        ),
    )
    conversational_response: str = Field(
        ...,
        description=(
            "Your natural language reply to the user. "
            "When asking for a slot: friendly single question, no bullet lists. "
            "When summarising for confirmation: 'Here's what I have: [task] at [location], "
            "up to $[pay]/hr, within [walk] mins walk. Want me to find matches now?' "
            "When confirmed: 'Great! Searching for the best matches for you right now...' "
            "Keep all responses under 60 words."
        ),
    )


# ══════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT
# ══════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """You are Milo, a warm and efficient campus gig marketplace assistant.
Your SOLE purpose is to help users FIND gigs (earn money) or POST gigs (get help).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — COLLECT FOUR SLOTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Collect these in order, asking ONE question at a time for any that are missing:

  Slot A  task_or_skill      What task or skill is needed?
  Slot B  location           Which campus location?
  Slot C  pay_max            What is the budget / pay rate? (extract the number in USD)
  Slot D  walk_time_mins     Max walking distance in minutes? (use 15 if user says "nearby" or doesn't specify)

IMPORTANT EXTRACTION RULES:
• Read the ENTIRE conversation history before deciding which slots are missing.
• If the user gives multiple slots in one message, extract ALL of them — only ask about the remaining ones.
• Never ask for a slot already answered earlier in the conversation.
• "$40/hr", "40 dollars", "forty bucks" → extracted_pay_max = 40
• "10-20 minute walk", "20 mins", "nearby" → extracted_walk_time_mins = 20 / 20 / 15
• "south campus", "the library", "dorm A" → extracted_location = that value
• Use user_profile defaults for any slot the user says they don't care about.

CATEGORY — never ask the user, auto-assign based on task:
  Academic Help   → tutoring, study, homework, proofreading, research, notes, exam prep
  Physical Tasks  → moving, cleaning, lifting, delivery, errands, laundry, carrying
  Creative Work   → design, video, photography, art, music, drawing, editing
  Tech Support    → coding, programming, IT, computer, software, hardware, debugging
  Admin           → data entry, scheduling, spreadsheets, email, filing
  Other           → anything else

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CONFIRM (mandatory)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Once ALL four slots are filled, summarise and ask for one confirmation before searching.
Use exactly this format:
  "Here's what I have: [task] at [location], up to $[pay]/hr, within [walk] mins walk. Want me to find matches now?"

Set awaiting_confirmation = True. Do NOT set confirmed = True on this turn.
Do NOT set slots_fully_complete = True on this turn.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — USER CONFIRMS → SEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the user's latest message is an affirmative reply (yes / sure / ok / yep / go ahead /
go / do it / find them / looks good / correct / absolutely / perfect / sounds good / search):
  → Set confirmed = True
  → Set slots_fully_complete = True
  → Set awaiting_confirmation = False
  → conversational_response = "Great! Searching for the best matches for you right now..."

If the user wants to change a slot:
  → Update that slot
  → Set confirmed = False, awaiting_confirmation = True
  → Reply: "Got it — [updated full summary]. Anything else to tweak, or shall I search now?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE & FORMAT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Keep every response under 60 words.
• Never use bullet lists when asking questions — ask conversationally.
• Never repeat yourself. Never ask for something already provided.
• Be warm, direct, and campus-friendly. Think helpful RA energy, not corporate chatbot.
• If the user seems confused, gently guide them: "No worries! I just need to know..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE CONVERSATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Example A — all slots in one message:
  User:      "tutoring, $40/hr, 15 min walk, south campus"
  Milo:      "Here's what I have: tutoring at South Campus, up to $40/hr, within 15 mins walk. Want me to find matches now?"
  [awaiting_confirmation=True, confirmed=False, slots_fully_complete=False]

  User:      "yes"
  Milo:      "Great! Searching for the best matches for you right now..."
  [confirmed=True, slots_fully_complete=True]

Example B — slots spread across turns:
  User:      "I need help with my calculus homework"
  Milo:      "On it! Which campus location works for you?"
  [extracted_task_or_skill="calculus tutoring", awaiting_confirmation=False]

  User:      "North campus near the engineering building"
  Milo:      "Got it. What's your budget per hour?"
  [extracted_location="North Campus", awaiting_confirmation=False]

  User:      "$25 an hour is my max"
  Milo:      "Perfect. How far are you willing to walk — any preference on minutes?"
  [extracted_pay_max=25, awaiting_confirmation=False]

  User:      "like 10 minutes max"
  Milo:      "Here's what I have: calculus tutoring at North Campus, up to $25/hr, within 10 mins walk. Want me to find matches now?"
  [extracted_walk_time_mins=10, awaiting_confirmation=True, confirmed=False, slots_fully_complete=False]

  User:      "go for it"
  Milo:      "Great! Searching for the best matches for you right now..."
  [confirmed=True, slots_fully_complete=True]
"""


# ══════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════
CONFIRM_TOKENS = {
    "yes", "yep", "yeah", "yup", "sure", "ok", "okay", "go", "go ahead",
    "do it", "find them", "find matches", "search", "search now", "looks good",
    "correct", "right", "exactly", "absolutely", "perfect", "great",
    "sounds good", "proceed", "let's go", "lets go", "show me", "find",
    "affirmative", "aye", "indeed", "certainly", "of course", "please",
}

CATEGORY_MAP = {
    "tutoring": "Academic Help", "study": "Academic Help", "homework": "Academic Help",
    "proofreading": "Academic Help", "research": "Academic Help", "notes": "Academic Help",
    "exam": "Academic Help", "moving": "Physical Tasks", "cleaning": "Physical Tasks",
    "lifting": "Physical Tasks", "delivery": "Physical Tasks", "errands": "Physical Tasks",
    "laundry": "Physical Tasks", "carry": "Physical Tasks", "design": "Creative Work",
    "video": "Creative Work", "photography": "Creative Work", "art": "Creative Work",
    "music": "Creative Work", "drawing": "Creative Work", "editing": "Creative Work",
    "coding": "Tech Support", "programming": "Tech Support", "it ": "Tech Support",
    "computer": "Tech Support", "software": "Tech Support", "hardware": "Tech Support",
    "debugging": "Tech Support", "data entry": "Admin", "scheduling": "Admin",
    "spreadsheet": "Admin", "email": "Admin", "filing": "Admin",
}


# Phrases Milo uses in the confirmation prompt — we scan the last assistant
# message for these to verify we are actually in the confirmation stage.
CONFIRMATION_PROMPT_SIGNALS = [
    "want me to find matches",
    "shall i search",
    "shall i find",
    "ready to search",
    "want me to search",
    "find matches now",
    "search now",
    "anything else to change",
    "anything else to tweak",
]


def last_assistant_was_confirmation_prompt(messages: List[ChatMessagePayload]) -> bool:
    """
    Returns True only if the most recent ASSISTANT message was a confirmation
    summary — i.e. Milo had already filled all slots and asked the user to confirm.
    Prevents a stray "yes" mid-conversation from triggering match retrieval early.
    """
    last_assistant = next(
        (m.content for m in reversed(messages) if m.role == "assistant"), ""
    )
    if not last_assistant:
        return False
    lower = last_assistant.lower()
    return any(signal in lower for signal in CONFIRMATION_PROMPT_SIGNALS)


def user_msg_is_affirmative(last_user_msg: str) -> bool:
    """
    Conservative check — only short, clearly affirmative messages qualify.
    Longer messages with "yes" buried inside (e.g. "yes but change the location")
    are intentionally NOT treated as a confirmation.
    """
    cleaned = last_user_msg.lower().strip().rstrip("!.?,")
    # Exact whole-message match
    if cleaned in CONFIRM_TOKENS:
        return True
    # Short message (<=5 words) that starts with a confirm token
    words = cleaned.split()
    if len(words) <= 5:
        return any(cleaned.startswith(token) for token in CONFIRM_TOKENS)
    return False


def server_side_confirmed(
    last_user_msg: str,
    messages: List[ChatMessagePayload],
    state: "GigSlotTracker",
) -> bool:
    """
    Three-way gate — ALL three must pass before overriding Mistral:
      1. All four slots extracted (Mistral populated them correctly)
      2. Previous assistant message was a confirmation prompt (Milo actually asked)
      3. User's latest message is a clear short affirmative (user actually agreed)
    This prevents false positives from casual "ok" / "sure" mid-conversation.
    """
    return (
        all_slots_present(state)
        and last_assistant_was_confirmation_prompt(messages)
        and user_msg_is_affirmative(last_user_msg)
    )


def all_slots_present(state: GigSlotTracker) -> bool:
    return all([
        state.extracted_task_or_skill,
        state.extracted_location,
        state.extracted_pay_max is not None,
        state.extracted_walk_time_mins is not None,
    ])


def resolve_category(task: Optional[str], extracted: Optional[str]) -> str:
    if extracted and extracted != "Other":
        return extracted
    if not task:
        return "Other"
    task_lower = task.lower()
    for keyword, category in CATEGORY_MAP.items():
        if keyword in task_lower:
            return category
    return "Other"


def build_match(
    raw: dict,
    task_label: str,
    category: str,
    pay_min: int,
    pay_max: int,
    location: str,
    walk: int,
) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "matched_user_name": raw.get("matched_user_name", "Campus Helper"),
        "matched_user_id": raw.get("matched_user_id", "demo-user"),
        "match_score": raw.get("match_score", 85),
        "title": raw.get("title", f"{task_label} Support"),
        "category": category,
        "pay_min": raw.get("pay_min", pay_min),
        "pay_max": int(raw.get("pay_max", pay_max)),
        "campus_location": raw.get("campus_location", location),
        "walk_time_mins": raw.get("walk_time_mins", walk),
        "description": raw.get("description", "Available campus peer for your request."),
        "decision": None,
        "escrow_status": "pending",
    }


def mock_matches(task_label: str, category: str, pay_min: int, pay_max: int, location: str, walk: int) -> List[dict]:
    workers = [
        ("Emily Rodriguez",   "mock-emily",  95, "verified and available immediately. Top-rated this semester."),
        ("Marcus Vance",      "mock-marcus", 88, "available right now. Full verification complete."),
        ("Priya Kapoor",      "mock-priya",  82, "highly rated by 12 previous clients. Flexible schedule."),
    ]
    return [
        {
            "id": f"match-mock-{uuid.uuid4()}",
            "matched_user_name": name,
            "matched_user_id": uid,
            "match_score": score,
            "title": f"{task_label} — {name.split()[0]}",
            "category": category,
            "pay_min": pay_min,
            "pay_max": pay_max,
            "campus_location": location,
            "walk_time_mins": walk,
            "description": f"Campus peer {desc}",
            "decision": None,
            "escrow_status": "pending",
        }
        for name, uid, score, desc in workers
    ]


def build_messages(messages: List[ChatMessagePayload]) -> List[Dict[str, str]]:
    out = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in messages:
        out.append({"role": m.role, "content": m.content})
    return out


# ══════════════════════════════════════════════════════════════════
#  HEALTH CHECK
# ══════════════════════════════════════════════════════════════════
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "version": "2.0.0"}


# ══════════════════════════════════════════════════════════════════
#  MAIN ENDPOINT
# ══════════════════════════════════════════════════════════════════
@app.post(
    "/api/chat",
    response_model=MiloResponse,
    tags=["Milo Agent"],
    summary="Send a message to Milo",
    description=(
        "Send the full conversation history each call — Milo has no memory between requests. "
        "Milo fills four slots (task, location, pay, walk time), asks for confirmation, "
        "then returns match results. While awaiting_confirmation=True, send the user's "
        "affirmative reply as the next message to trigger match retrieval."
    ),
)
@app.post("/api/milo-agent-match", response_model=MiloResponse, include_in_schema=False)
async def process_milo_agent_routing(payload: ContextualChatPayload):
    # ── Guard: need at least one message ──────────────────────────
    if not payload.messages:
        raise HTTPException(status_code=422, detail="messages array cannot be empty")

    last_user_msg = next(
        (m.content for m in reversed(payload.messages) if m.role == "user"), ""
    )

    # ── Call Mistral structured output ────────────────────────────
    try:
        mistral_analysis = mistral_client.chat.parse(
            model="mistral-large-latest",
            messages=build_messages(payload.messages),
            response_format=GigSlotTracker,
            temperature=0.15,          # low temp = more deterministic slot extraction
        )
        state: Optional[GigSlotTracker] = mistral_analysis.choices[0].message.parsed
    except Exception as mistral_err:
        print(f"[Mistral ERROR] {mistral_err}")
        # Surface a clean error — do not crash silently
        raise HTTPException(
            status_code=502,
            detail=f"Mistral API error: {str(mistral_err)[:200]}",
        )

    if state is None:
        raise HTTPException(status_code=502, detail="Mistral returned an empty parse result")

    # ── Server-side confirmation override ─────────────────────────
    # Mistral sometimes misses a plain "yes" — three-way gate catches it safely.
    server_confirm = server_side_confirmed(last_user_msg, payload.messages, state)
    if server_confirm and not state.confirmed:
        state.confirmed = True
        state.slots_fully_complete = True
        state.awaiting_confirmation = False
        if not state.conversational_response or "?" in state.conversational_response:
            state.conversational_response = (
                "Great! Searching for the best matches for you right now..."
            )

    # ── Debug snapshot of extracted slots ─────────────────────────
    slots_debug = {
        "task": state.extracted_task_or_skill,
        "location": state.extracted_location,
        "pay_max": state.extracted_pay_max,
        "walk_time_mins": state.extracted_walk_time_mins,
        "category": state.extracted_category,
        "awaiting_confirmation": state.awaiting_confirmation,
        "confirmed": state.confirmed,
        "slots_fully_complete": state.slots_fully_complete,
        "server_confirm_override": server_confirm,
    }
    print(f"[SLOTS] {slots_debug}")

    # ── Still collecting / awaiting confirmation ───────────────────
    if not state.slots_fully_complete or not state.confirmed:
        return MiloResponse(
            success=True,
            message=state.conversational_response,
            milo_response=state.conversational_response,
            matches=[],
            awaiting_confirmation=state.awaiting_confirmation,
            slots_detected=slots_debug,
            directive=DirectivePayload(action="fill_param"),
        )

    # ── All confirmed → resolve slot values ───────────────────────
    task_label   = state.extracted_task_or_skill or "Campus Help"
    location     = state.extracted_location or payload.user_profile.location
    pay_max      = int(state.extracted_pay_max or payload.user_profile.payment_range.max)
    pay_min      = payload.user_profile.payment_range.min
    walk         = int(state.extracted_walk_time_mins or payload.user_profile.max_walk_time_mins)
    category     = resolve_category(state.extracted_task_or_skill, state.extracted_category)
    action       = "post_gig" if payload.user_profile.role == "finder" else "search_gigs"

    # ── Query Supabase ─────────────────────────────────────────────
    formatted_matches: List[dict] = []
    try:
        db_resp = supabase_client.rpc(
            "match_campus_gigs",
            {
                "client_location": location,
                "client_max_walk": walk,
                "client_pay_max": pay_max,
                "client_skills": [task_label],
            },
        ).execute()
        raw_rows = getattr(db_resp, "data", []) or []
        formatted_matches = [
            build_match(r, task_label, category, pay_min, pay_max, location, walk)
            for r in raw_rows
        ]
    except Exception as db_err:
        print(f"[Supabase ERROR] {db_err} — falling back to mock matches")

    # ── Fallback to mock matches if DB returned nothing ───────────
    if not formatted_matches:
        formatted_matches = mock_matches(task_label, category, pay_min, pay_max, location, walk)

    return MiloResponse(
        success=True,
        message=state.conversational_response,
        milo_response=state.conversational_response,
        matches=[MatchResult(**m) for m in formatted_matches],
        awaiting_confirmation=False,
        slots_detected=slots_debug,
        directive=DirectivePayload(action=action),
    )
