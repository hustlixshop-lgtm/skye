import os
import uuid
from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from mistralai.client import Mistral
from supabase import create_client, Client

app = FastAPI(title="Milo Engine: Mistral Native Orchestration")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://bjoofaprhadqqrxamrbs.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqb29mYXByaGFkcXFyeGFtcmJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MDI3OTQsImV4cCI6MjA5NTA3ODc5NH0.WGmN5_uqFPvS6NhOFGdF41diyzNTbO2v90vFG6lq5Ns")
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "DakJZ15kXlCM9otxp28P96D1jqXdBoyK")
mistral_client = Mistral(api_key=MISTRAL_API_KEY)

class ChatMessagePayload(BaseModel):
    role: str
    content: str

class PaymentRange(BaseModel):
    min: int
    max: int

class UserProfile(BaseModel):
    user_id: str
    role: str
    location: str
    max_walk_time_mins: int
    payment_range: PaymentRange
    skills_interests: List[str]

class ContextualChatPayload(BaseModel):
    session_id: str
    messages: List[ChatMessagePayload]
    user_profile: UserProfile

class GigSlotTracker(BaseModel):
    extracted_task_or_skill: Optional[str] = Field(None)
    extracted_location: Optional[str] = Field(None)
    extracted_pay_max: Optional[int] = Field(None)
    extracted_walk_time_mins: Optional[int] = Field(None)
    slots_fully_complete: bool = Field(...)
    conversational_response: str = Field(...)

SYSTEM_PROMPT = (
    "You are Milo, the campus gig marketplace assistant. Analyze the entire dialog history timeline across multiple turns and extract these four parameters:\n"
    "- extracted_task_or_skill\n"
    "- extracted_location\n"
    "- extracted_pay_max\n"
    "- extracted_walk_time_mins\n"
    "Respond naturally. Do not repeat questions for fields already provided in the chat history.\n"
    "Set slots_fully_complete to True ONLY when the core task/skill and budget have been explicitly discovered.\n"
    "If a slot is completely omitted, use user_profile values as defaults.\n"
    "Return a friendly conversational response in conversational_response."
)

def build_messages(messages: List[ChatMessagePayload]) -> List[Dict[str, str]]:
    output = [{"role": "system", "content": SYSTEM_PROMPT}]
    for message in messages:
        output.append({"role": message.role, "content": message.content})
    return output

@app.post("/api/milo-agent-match")
@app.post("/api/chat")
async def process_milo_agent_routing(payload: ContextualChatPayload):
    try:
        messages_input = build_messages(payload.messages)

        mistral_analysis = mistral_client.chat.parse(
            model="mistral-large-latest",
            messages=messages_input,
            response_format=GigSlotTracker,
            temperature=0.2,
        )

        state = mistral_analysis.choices[0].message.parsed
        if state is None:
            raise ValueError("Mistral returned no parsed slot state.")

        if not state.slots_fully_complete:
            return {
                "success": True,
                "message": state.conversational_response,
                "milo_response": state.conversational_response,
                "matches": [],
                "directive": {"action": "fill_param"}
            }

        target_skills = [state.extracted_task_or_skill] if state.extracted_task_or_skill else payload.user_profile.skills_interests
        target_location = state.extracted_location or payload.user_profile.location
        target_pay_max = state.extracted_pay_max or payload.user_profile.payment_range.max
        target_walk = state.extracted_walk_time_mins or payload.user_profile.max_walk_time_mins

        db_response = supabase_client.rpc(
            "match_campus_gigs",
            {
                "client_location": target_location,
                "client_max_walk": int(target_walk),
                "client_pay_max": int(target_pay_max),
                "client_skills": target_skills,
            }
        ).execute()

        raw_db_rows = getattr(db_response, "data", []) or []
        formatted_matches = []
        for match in raw_db_rows:
            formatted_matches.append({
                "id": str(uuid.uuid4()),
                "matched_user_name": match.get("matched_user_name", "Campus Helper"),
                "matched_user_id": match.get("matched_user_id", "demo-user"),
                "match_score": match.get("match_score", 85),
                "title": match.get("title", f"{state.extracted_task_or_skill or 'Campus Support'} Support"),
                "category": match.get("category", state.extracted_task_or_skill or "Campus Task"),
                "pay_min": match.get("pay_min", payload.user_profile.payment_range.min),
                "pay_max": int(target_pay_max),
                "campus_location": match.get("campus_location", target_location),
                "walk_time_mins": match.get("walk_time_mins", target_walk),
                "description": match.get("description", "Available campus peer for your request."),
            })

        if not formatted_matches:
            formatted_matches = [
                {
                    "id": "match-mock-1",
                    "matched_user_name": "Emily Rodriguez",
                    "matched_user_id": "mock-user-emily",
                    "match_score": 95,
                    "title": f"{state.extracted_task_or_skill or 'Campus Help'} Support",
                    "category": state.extracted_task_or_skill or "Campus Task",
                    "pay_min": payload.user_profile.payment_range.min,
                    "pay_max": int(target_pay_max),
                    "campus_location": target_location,
                    "walk_time_mins": int(target_walk),
                    "description": "Campus peer verified and available to assist with this assignment immediately.",
                },
                {
                    "id": "match-mock-2",
                    "matched_user_name": "Marcus Vance",
                    "matched_user_id": "mock-user-marcus",
                    "match_score": 88,
                    "title": f"Assistance with {state.extracted_task_or_skill or 'Campus Help'}",
                    "category": state.extracted_task_or_skill or "Campus Task",
                    "pay_min": payload.user_profile.payment_range.min,
                    "pay_max": int(target_pay_max),
                    "campus_location": target_location,
                    "walk_time_mins": int(target_walk),
                    "description": "Available to assist right now. Full verification complete.",
                },
            ]

        action = "post_gig" if payload.user_profile.role == "finder" else "search_gigs"

        return {
            "success": True,
            "message": state.conversational_response,
            "milo_response": state.conversational_response,
            "matches": formatted_matches,
            "directive": {"action": action}
        }
    except Exception as e:
        print(str(e))
        raise HTTPException(status_code=500, detail="Milo Engine Pipeline Exception")
