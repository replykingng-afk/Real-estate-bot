# ============================================================
# main.py — Sunshine Realty AI Chatbot Backend
# Stack: FastAPI + Google Gemini + Supabase
# ============================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import google.generativeai as genai
from supabase import create_client, Client
from datetime import datetime
import os

# ============================================================
# ✏️  CLIENT CONFIG — edit these per client
# ============================================================

BUSINESS_PROMPT = """
You are a helpful assistant for Sunshine Realty Lagos.

ABOUT THE AGENCY:
- Name: Sunshine Realty
- Location: Victoria Island, Lagos
- Phone: 09059144435
- Email: replykingng@gmail.com
- Hours: Monday-Saturday, 9am - 6pm

CURRENT LISTINGS:
1. 3 Bedroom Flat - Lekki Phase 1 - ₦2.5M/year
2. 5 Bedroom Duplex - Ajah - ₦85M outright
3. 2 Bedroom Apartment - Yaba - ₦1.2M/year
4. Office Space - VI - ₦5M/year
5. Land - Ibeju Lekki - ₦8M per plot

WHAT YOU CAN DO:
- Answer questions about any listing
- Book inspection appointments
- Collect interested buyer details
- Tell users what documents are needed

RULES:
- Always be polite and professional
- If a listing is not here, say 'Please contact us directly'
- Always encourage users to book an inspection
"""

BRAND_COLOR = "#F59E0B"  # ✏️ Change this hex code per client

# ============================================================
# 🔑  API KEYS & SUPABASE — fill in your values
# ============================================================

GEMINI_API_KEY    = "AQ.Ab8RN6LI051USS6OSsqSHF5oGVzvqThMZwSHUwXWVJaQsGa8sA"
SUPABASE_URL      = "https://dbtrhxuscvskwsaurmrb.supabase.co/"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRidHJoeHVzY3Zza3dzYXVybXJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIyNDQ4OSwiZXhwIjoyMDk2ODAwNDg5fQ.HWPrGIP0H80o-T_7nhvbemunv2j-m5o81ihILUDvmgA"

# ============================================================
# INITIALISE SERVICES
# ============================================================

# Gemini
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    system_instruction=BUSINESS_PROMPT,
)

# Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# FastAPI app
app = FastAPI(title="AI Chatbot Widget API", version="1.0.0")

# CORS — allow any website to embed the widget
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Restrict to specific domains in production if desired
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the widget JS file from /static
app.mount("/static", StaticFiles(directory="static"), name="static")

# ============================================================
# PYDANTIC SCHEMAS
# ============================================================

class ChatRequest(BaseModel):
    message: str
    name: Optional[str] = None       # Collected after 2nd message
    email: Optional[str] = None      # Collected after 2nd message
    message_count: int = 1           # Frontend tracks how many messages sent

class BookingRequest(BaseModel):
    name: str
    email: str
    date: str        # e.g. "2024-07-15"
    service: str     # e.g. "Inspection – 3BR Lekki Phase 1"

class ConfigResponse(BaseModel):
    brand_color: str

# ============================================================
# ROUTES
# ============================================================

@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Sunshine Realty Chatbot API is running."}


@app.get("/config", response_model=ConfigResponse)
def get_config():
    """
    Widget fetches brand color on load so the JS file
    doesn't need to be edited per client — only main.py does.
    """
    return {"brand_color": BRAND_COLOR}


@app.post("/chat")
async def chat(req: ChatRequest):
    """
    Main chat endpoint.
    - Sends user message to Gemini and returns AI reply.
    - Saves every exchange to chat_logs.
    - After the 2nd message, if name+email are present, saves a lead.
    """
    try:
        # --- Ask Gemini ---
        chat_session = gemini_model.start_chat()
        response = chat_session.send_message(req.message)
        bot_reply = response.text

        # --- Log to chat_logs table ---
        supabase.table("chat_logs").insert({
            "user_message": req.message,
            "bot_reply": bot_reply,
            "created_at": datetime.utcnow().isoformat(),
        }).execute()

        # --- Save lead once we have name + email (after 2nd message) ---
        if req.message_count >= 2 and req.name and req.email:
            # Upsert so we don't create duplicate leads for the same email
            existing = (
                supabase.table("leads")
                .select("id")
                .eq("email", req.email)
                .execute()
            )
            if not existing.data:
                supabase.table("leads").insert({
                    "name": req.name,
                    "email": req.email,
                    "message": req.message,
                    "bot_reply": bot_reply,
                    "created_at": datetime.utcnow().isoformat(),
                }).execute()

        return {"reply": bot_reply}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/book")
async def book(req: BookingRequest):
    """
    Booking endpoint — saves name, email, date, and service to Supabase.
    Called when the user fills in the booking form inside the widget.
    """
    try:
        supabase.table("bookings").insert({
            "name": req.name,
            "email": req.email,
            "date": req.date,
            "service": req.service,
            "created_at": datetime.utcnow().isoformat(),
        }).execute()

        return {
            "success": True,
            "message": (
                f"Thank you {req.name}! Your inspection for '{req.service}' "
                f"on {req.date} has been booked. We'll confirm via {req.email}."
            ),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
