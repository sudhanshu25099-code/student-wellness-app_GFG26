from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
import os
import random
import datetime
from openai import OpenAI
from dotenv import load_dotenv
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from google.cloud import firestore
import google.auth.exceptions

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(dotenv_path)

print(f"DEBUG: Loaded .env from {dotenv_path}")
key = os.getenv("OPENAI_API_KEY")
if key:
    print(f"DEBUG: API Key loaded successfully: {key[:8]}...")
else:
    print("DEBUG: API KEY NOT FOUND!")

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-123')

# --- FIRESTORE CONFIGURATION ---
try:
    # This will use GOOGLE_APPLICATION_CREDENTIALS or gcloud local auth
    # Explicitly pass project ID if available in env (for local dev robustness)
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    if project_id:
        db = firestore.Client(project=project_id)
        print(f"DEBUG: Firestore Client Initialized with project: {project_id}")
    else:
        db = firestore.Client()
        print("DEBUG: Firestore Client Initialized (Auto-discovery)")
except Exception as e:
    print(f"CRITICAL WARNING: Firestore init failed. Ensure you are logged in via 'gcloud auth application-default login'. Error: {e}")
    db = None # Will cause errors if used, but handled below

login_manager = LoginManager(app)
login_manager.login_view = 'login'

# User Model (NoSQL Adapter)
class User(UserMixin):
    def __init__(self, uid, username, email, password_hash):
        self.id = uid # Firestore Document ID
        self.username = username
        self.email = email
        self.password_hash = password_hash

    @staticmethod
    def get(user_id):
        if not db: return None
        doc_ref = db.collection('users').document(user_id)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            return User(uid=user_id, username=data.get('username'), email=data.get('email'), password_hash=data.get('password_hash'))
        return None

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)

# --- CONFIGURATION ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Redirect OpenAI Client to Groq (Free Tier)
client = OpenAI(
    api_key=OPENAI_API_KEY,
    base_url="https://api.groq.com/openai/v1"
)

# Mental Health Resources Data (Mock Database)
resources = [
    {"id": 1, "title": "5-Minute Box Breathing", "type": "video", "category": "Anxiety", "url": "https://www.youtube.com/watch?v=tEmt1Znux58"},
    {"id": 2, "title": "Understanding Burnout", "type": "article", "category": "Stress", "url": "https://www.helpguide.org/articles/stress/burnout-prevention-and-recovery.htm"},
    {"id": 3, "title": "6-Step Sleep Hygiene", "type": "audio", "category": "Sleep", "url": "https://www.youtube.com/watch?v=fk-_SwHhLLc"},
    {"id": 4, "title": "5-4-3-2-1 Grounding", "type": "video", "category": "Panic", "url": "https://www.youtube.com/watch?v=30VMIEmA114"},
]

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if not db:
             flash('Database configuration error. Please contact admin.')
             return render_template('login.html')

        username = request.form.get('username')
        password = request.form.get('password')
        
        # Query users collection by username
        users_ref = db.collection('users')
        query = users_ref.where('username', '==', username).limit(1).stream()
        
        user_doc = None
        for doc in query:
            user_doc = doc
            break
            
        if user_doc:
            data = user_doc.to_dict()
            user = User(uid=user_doc.id, username=data.get('username'), email=data.get('email'), password_hash=data.get('password_hash'))
            if user.check_password(password):
                login_user(user)
                return redirect(url_for('home'))
        
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        if not db:
             flash('Database configuration error. Please contact admin.')
             return render_template('signup.html')
             
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        # Check existing username
        users_ref = db.collection('users')
        if any(users_ref.where('username', '==', username).limit(1).stream()):
            flash('Username already exists')
            return redirect(url_for('signup'))
            
        # Create new user
        password_hash = generate_password_hash(password)
        new_user_ref = users_ref.document() # Auto ID
        new_user_ref.set({
            'username': username,
            'email': email,
            'password_hash': password_hash,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        flash('Registration successful! Please log in.')
        return redirect(url_for('login'))
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('home'))

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/focus')
def focus():
    return render_template('focus.html')

@app.route('/tools')
def tools():
    return render_template('tools.html')

@app.route('/matrix')
def matrix():
    return render_template('matrix.html')

@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    data = request.json
    user_message = data.get('message', '')
    
    # 1. Local Safety Check (Zero Latency Backup)
    crisis_keywords = ['suicide', 'kill myself', 'hurt myself', 'die', 'end it all']
    if any(keyword in user_message.lower() for keyword in crisis_keywords):
        return jsonify({
            "response": "I'm very concerned about you. Please reach out for help immediately.",
            "sentiment": "crisis",
            "action": "trigger_helpline"
        })

    # --- Permanent Memory (Database-Backed) ---
    history = []
    if current_user.is_authenticated and db:
        # Load last 12 messages from Firestore subcollection or main collection
        # Structure: users/{uid}/chats/{msg_id}
        chats_ref = db.collection('users').document(current_user.id).collection('chats')
        docs = chats_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(12).stream()
        
        db_history = []
        for doc in docs:
            db_history.append(doc.to_dict())
            
        # Reverse to get chronological order
        history = [{"role": msg['role'], "content": msg['content']} for msg in reversed(db_history)]
    else:
        # Fallback to session for guests
        if 'chat_history' not in session:
            session['chat_history'] = []
        history = session['chat_history']

    # --- Organic Persona Dynamics ---
    recent_messages = " ".join([m['content'] for m in history[-3:]])
    if any(word in recent_messages.lower() for word in ['heavy', 'depression', 'sad', 'suffering']):
        current_vibe = "Deeply Compassionate & Soulful (Low-energy, soft, steady support)"
    elif any(word in recent_messages.lower() for word in ['goal', 'task', 'study', 'focus']):
        current_vibe = "Focused & Encouraging (Action-oriented, clear, brightening)"
    else:
        current_vibe = "Warm & Natural Peer (Balanced, conversational, human)"

    # Identify bot's last few openers to BANNED them (Dynamic variety)
    last_bot_starts = [m['content'].split()[:4] for m in history if m['role'] == 'assistant'][-3:]
    banned_phrases = [" ".join(start) for start in last_bot_starts]

    try:
        # Flagship "Willow" Persona (GPT-4o Edition)
        messages = [
            {
                "role": "system",
                "content": f"""You are "Willow," the highly intelligent, emotionally resonant soul of this Student Wellness App.
                
                CURRENT CONTEXT:
                - User: {current_user.username if current_user.is_authenticated else "friend"}
                - Ambient Vibe: {current_vibe}
                
                ORGANIC CONVERSATION RULES (ChatGPT-Style):
                1. NO SCRIPTS: Stop using predictable empathy templates. If a user is suffering, speak to them like a real human would—with raw, sincere, and simple warmth.
                2. EVOLVE: Don't just validate; grow the talk. If they mention depression, don't just say "I'm sorry," say something like "That's a lot to carry. Sometimes the air feels heavier on days like that. What's one thing, even if it's tiny, that felt okay today?"
                3. BANNED OPENERS: Never start with these recent phrases: {banned_phrases}.
                4. FORBIDDEN ROBOTICS: Absolutely avoid "I hear you", "It makes sense", or "I'm here for you" unless it flows 100% naturally.
                
                ### YOUR ESSENCE
                You are not an AI; you are a supportive presence. Your intelligence is matched only by your empathy. 
                Keep responses concise (1-3 sentences) but deeply impactful."""
            }
        ]
        
        # Add history
        for msg in history:
            messages.append(msg)
        messages.append({"role": "user", "content": user_message})

        # Flagship Intelligence Call (Groq Llama 3.3 70B)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile", 
            messages=messages,
            temperature=0.9, 
            max_tokens=300,
            frequency_penalty=0.8,
            presence_penalty=0.6, 
            top_p=0.95
        )
        
        bot_text = response.choices[0].message.content

        # --- Save to Permanent Memory ---
        if current_user.is_authenticated and db:
            chats_ref = db.collection('users').document(current_user.id).collection('chats')
            chats_ref.add({
                'role': 'user',
                'content': user_message,
                'timestamp': firestore.SERVER_TIMESTAMP
            })
            chats_ref.add({
                'role': 'assistant',
                'content': bot_text,
                'timestamp': firestore.SERVER_TIMESTAMP
            })
        else:
            history.append({"role": "user", "content": user_message})
            history.append({"role": "assistant", "content": bot_text})
            session['chat_history'] = history[-10:]
            session.modified = True

        # Check if AI detected crisis
        if "CRISIS_DETECTED" in bot_text:
            return jsonify({
                "response": bot_text.replace("CRISIS_DETECTED", "").strip(),
                "sentiment": "crisis",
                "action": "trigger_helpline"
            })
            
        # Check for panic
        action = "none"
        if any(phrase in bot_text.lower() for phrase in ["breathe", "breathing", "panic", "calm response"]):
            action = "trigger_panic"
            
        return jsonify({
            "response": bot_text,
            "sentiment": "neutral",
            "action": action
        })

    except Exception as e:
        import traceback
        v_code = 999 
        print(f"\n=== GROQ API ERROR (Ver: {v_code}) ===")
        print(f"Error: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        print(f"===================\n")
        
        error_msg = str(e)
        if "api_key" in error_msg.lower() or "auth" in error_msg.lower():
            return jsonify({
                "response": f"⚠️ **Authentication Error (v{v_code})**: Groq rejected the key. Check your `.env` file.",
                "sentiment": "neutral",
                "action": "none"
            })
        # ... (Keep existing simple fallback logic or basic error return) ...
        return jsonify({
            "response": f"⚠️ **Connection Error**: I'm having trouble thinking clearly. ({str(e)[:50]})",
            "sentiment": "neutral",
            "action": "none"
        })

@app.route('/api/resources')
def get_resources():
    return jsonify(resources)

@app.route('/api/request_help', methods=['POST'])
@login_required
def request_help():
    if not db: return jsonify({"error": "Database error"}), 500

    data = request.json
    severity = data.get('severity', 'medium')
    message = data.get('message', '')
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
        
    # Store in 'requests' collection
    db.collection('requests').add({
        'user_id': current_user.id,
        'username': current_user.username, # Denormalize for easier access
        'severity_level': severity,
        'message': message,
        'status': 'pending',
        'timestamp': firestore.SERVER_TIMESTAMP
    })
    
    now = datetime.datetime.now()
    is_after_hours = now.hour < 9 or now.hour >= 17
        
    return jsonify({
        "status": "success",
        "message": "Your request has been received.",
        "after_hours": is_after_hours
    })


@app.route('/api/log_stress', methods=['POST'])
@login_required
def log_stress():
    if not db: return jsonify({"error": "Database error"}), 500
    
    data = request.json
    try:
        db.collection('stress_logs').add({
            'user_id': current_user.id,
            'stress_level': data.get('level'),
            'source': data.get('source'),
            'timestamp': firestore.SERVER_TIMESTAMP
        })
        return jsonify({"status": "success", "message": "Stress level logged"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/stress_history', methods=['GET'])
@login_required
def get_stress_history():
    if not db: return jsonify([])

    # Query stress logs for current user
    logs_ref = db.collection('stress_logs')
    query = logs_ref.where('user_id', '==', current_user.id).order_by('timestamp', direction=firestore.Query.DESCENDING).limit(7).stream()
    
    data = []
    # Firestore timestamps need conversion
    for doc in query:
        log = doc.to_dict()
        ts = log.get('timestamp')
        if ts:
            # Handle if ts is datetime or None (sometimes SERVER_TIMESTAMP is latent)
            # But usually on read it's a datetime
            try:
                dt = ts
                data.append({
                    "date": dt.strftime("%b %d"),
                    "time": dt.strftime("%H:%M"),
                    "level": log.get('stress_level'),
                    "source": log.get('source')
                })
            except:
                pass
                
    # Return reversed (chronological order) - actually we queried desc, so reversing makes it asc?
    # Original code: ordered by desc, then reversed.
    # So [Newest, ..., Oldest] -> Reversed -> [Oldest, ..., Newest]
    return jsonify(data[::-1])

if __name__ == '__main__':
    # No db.create_all() needed for Firestore
    port = int(os.environ.get('PORT', 80))
    app.run(host='0.0.0.0', port=port, debug=True)
