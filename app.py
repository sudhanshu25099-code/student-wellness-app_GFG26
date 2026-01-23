from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
import os
import random
import datetime
from openai import OpenAI
from dotenv import load_dotenv
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

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

# --- DATABASE CONFIGURATION (PostgreSQL / SQLite) ---
# Use DATABASE_URL from environment (Render provides this)
# Fallback to local SQLite database for development
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///wellness.db')
if app.config['SQLALCHEMY_DATABASE_URI'].startswith("postgres://"):
    # Fix for Heroku/Render postgres URLs (SQLAlchemy requires postgresql://)
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)

login_manager = LoginManager(app)
login_manager.login_view = 'login'

# --- MODELS ---

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), nullable=True)
    password_hash = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    # Relationships
    chats = db.relationship('ChatHistory', backref='user', lazy=True)
    stress_logs = db.relationship('StressLog', backref='user', lazy=True)
    requests = db.relationship('HelpRequest', backref='user', lazy=True)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False) # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class StressLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    stress_level = db.Column(db.Integer, nullable=False)
    source = db.Column(db.String(100), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class HelpRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    severity = db.Column(db.String(20), default='medium')
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='pending')
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

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
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
            
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('home'))
        
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        # Check existing username
        if User.query.filter_by(username=username).first():
            flash('Username already exists')
            return redirect(url_for('signup'))
            
        # Create new user
        password_hash = generate_password_hash(password)
        new_user = User(username=username, email=email, password_hash=password_hash)
        
        try:
            db.session.add(new_user)
            db.session.commit()
            flash('Registration successful! Please log in.')
            return redirect(url_for('login'))
        except Exception as e:
            db.session.rollback()
            flash(f"Error creating account: {e}")
            return redirect(url_for('signup'))

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
    if current_user.is_authenticated:
        # Load last 12 messages from SQL
        recent_chats = ChatHistory.query.filter_by(user_id=current_user.id).order_by(ChatHistory.timestamp.desc()).limit(12).all()
        # Reverse to get chronological order
        history = [{"role": msg.role, "content": msg.content} for msg in reversed(recent_chats)]
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
        if current_user.is_authenticated:
            user_msg_db = ChatHistory(user_id=current_user.id, role='user', content=user_message)
            bot_msg_db = ChatHistory(user_id=current_user.id, role='assistant', content=bot_text)
            db.session.add(user_msg_db)
            db.session.add(bot_msg_db)
            db.session.commit()
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
    data = request.json
    severity = data.get('severity', 'medium')
    message = data.get('message', '')
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
        
    new_request = HelpRequest(
        user_id=current_user.id,
        severity=severity,
        message=message
    )
    
    try:
        db.session.add(new_request)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
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
    data = request.json
    try:
        new_log = StressLog(
            user_id=current_user.id,
            stress_level=data.get('level'),
            source=data.get('source')
        )
        db.session.add(new_log)
        db.session.commit()
        return jsonify({"status": "success", "message": "Stress level logged"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/stress_history', methods=['GET'])
@login_required
def get_stress_history():
    # Query stress logs for current user
    logs = StressLog.query.filter_by(user_id=current_user.id)\
        .order_by(StressLog.timestamp.desc())\
        .limit(7).all()
    
    data = []
    for log in logs:
        # SQL timestamps are already datetime objects
        try:
            dt = log.timestamp
            data.append({
                "date": dt.strftime("%b %d"),
                "time": dt.strftime("%H:%M"),
                "level": log.stress_level,
                "source": log.source
            })
        except:
            pass
                
    # Return reversed (chronological order)
    return jsonify(data[::-1])

if __name__ == '__main__':
    # Initialize DB (Auto-create tables for development)
    with app.app_context():
        db.create_all()
        print("DEBUG: Database tables created (if not exist)")

    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)
