from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
import os
import random
import datetime
from openai import OpenAI
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-123')
app.config['SQLALCHEMY_DATABASE_HOST'] = 'sqlite:///wellness.db' # For Windows/Render compatibility
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///wellness.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# User Model
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class CounselorRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    severity_level = db.Column(db.String(20), nullable=False) # 'low', 'medium', 'high', 'crisis'
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='pending') # 'pending', 'resolved'
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('requests', lazy=True))

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False) # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- CONFIGURATION ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

# Mental Health Resources Data (Mock Database)
resources = [
    {"id": 1, "title": "5-Minute Box Breathing", "type": "video", "category": "Anxiety", "url": "#"},
    {"id": 2, "title": "Understanding Burnout", "type": "article", "category": "Stress", "url": "#"},
    {"id": 3, "title": "Sleep Hygiene 101", "type": "audio", "category": "Sleep", "url": "#"},
    {"id": 4, "title": "Grounding Techniques", "type": "video", "category": "Panic", "url": "#"},
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
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists')
            return redirect(url_for('signup'))
            
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
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
    if current_user.is_authenticated:
        # Load last 12 messages from DB
        db_history = ChatMessage.query.filter_by(user_id=current_user.id).order_by(ChatMessage.timestamp.desc()).limit(12).all()
        history = [{"role": msg.role, "content": msg.content} for msg in reversed(db_history)]
    else:
        # Fallback to session for guests
        if 'chat_history' not in session:
            session['chat_history'] = []
        history = session['chat_history']

    # --- Organic Persona Dynamics ---
    # Instead of rigid archetypes, we give Willow a 'Mood Drift' based on the conversation energy.
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

        # Flagship Intelligence Call
        response = client.chat.completions.create(
            model="gpt-4o", # THE FLAGSHIP MODEL (Real ChatGPT Experience)
            messages=messages,
            temperature=1.0, # High temperature for true organic variety
            max_tokens=300,
            frequency_penalty=1.2, 
            presence_penalty=1.0, 
            top_p=0.9
        )
        
        bot_text = response.choices[0].message.content

        # --- Save to Permanent Memory ---
        if current_user.is_authenticated:
            db.session.add(ChatMessage(user_id=current_user.id, role='user', content=user_message))
            db.session.add(ChatMessage(user_id=current_user.id, role='assistant', content=bot_text))
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
            
        # Check for panic/breathing suggestions in AI response
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
        print(f"\n=== OPENAI API ERROR ===")
        print(f"Error: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        print(f"===================\n")
        
        # Check for specific authentication errors
        error_msg = str(e)
        if "api_key" in error_msg.lower() or "auth" in error_msg.lower():
            return jsonify({
                "response": "⚠️ **Authentication Error**: The API rejected your key. Please check your `OPENAI_API_KEY` in the `.env` file.",
                "sentiment": "neutral",
                "action": "none"
            })
        elif "quota" in error_msg.lower() or "429" in error_msg:
            return jsonify({
                "response": "⚠️ **Billing Error**: Use of OpenAI API requires credits. **Your free trial has expired or you are out of credits.** Please go to [platform.openai.com/billing](https://platform.openai.com/account/billing/overview) and add $5 to your balance to restore Willow.",
                "sentiment": "neutral",
                "action": "none"
            })
            
        # Fallback: Smart keyword-based responses when API is unavailable
        user_lower = user_message.lower()
        
        # Expanded Fallback Logic
        if any(word in user_lower for word in ['stress', 'stressed', 'overwhelm']):
            fallback_response = "That's completely understandable. Try this right now: Take 3 deep breaths - 4 seconds in, hold for 4, breathe out for 6. This activates your calm response."
            action = "trigger_panic"
        elif any(word in user_lower for word in ['exam', 'test', 'study', 'assignment']):
            fallback_response = "Exam stress is real. Break your study into 25-minute chunks (Pomodoro method) with 5-min breaks. Start with just ONE topic for 10 minutes to build momentum."
            action = "none"
        elif any(word in user_lower for word in ['sleep', 'insomnia', 'tired', 'exhausted']):
            fallback_response = "Poor sleep affects everything. Tonight, try this: Set your phone outside your bedroom 30 minutes before bed. Your sleep quality will improve."
            action = "none"
        elif any(word in user_lower for word in ['lonely', 'alone', 'isolated', 'sad']):
            fallback_response = "Feeling isolated is hard, especially as a student. Quick action: Text one friend right now, even just 'hey, how are you?' Connection helps."
            action = "none"
        elif any(word in user_lower for word in ['anxious', 'anxiety', 'nervous', 'panic']):
            fallback_response = "Anxiety is tough. Try the 5-4-3-2-1 technique: Name 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste. This grounds you in the present."
            action = "trigger_panic"
        elif any(word in user_lower for word in ['fail', 'failure', 'doubt', 'imposter']):
            fallback_response = "Imposter syndrome is common among high-achievers. Quick reminder: You got into this school for a reason. Write down 3 things you did well today."
            action = "none"
        elif any(word in user_lower for word in ['depression', 'depressed', 'hopeless', 'suffering', 'mental health']):
            fallback_response = "I hear that you're in a dark place right now, and I want you to know you're not alone. When depression hits, even small steps are victories. Have you eaten or had water today? 💙"
            action = "none"
        else:
            # Randomize generic fallback to prevent exact repetition
            generic_fallbacks = [
                "I hear you, and I'm listening. Could you tell me a bit more about what's mistakenly on your mind?",
                "IDK That sounds heavy. I'm here to be a thinking partner if you want to unpack it.",
                "I'm having trouble connecting to my creative brain right now, but I'm still here. How can I support you best?",
                "It seems I'm offline, but I want to help. What's the biggest thing bothering you right now?"
            ]
            fallback_response = f"{random.choice(generic_fallbacks)} (Note: I am currently in 'Offline Mode' due to a connection error: {str(e)[:50]}...)"
            action = "none"
        
        return jsonify({
            "response": fallback_response,
            "sentiment": "neutral",
            "action": action
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
        
    new_request = CounselorRequest(
        user_id=current_user.id,
        severity_level=severity,
        message=message
    )
    db.session.add(new_request)
    db.session.commit()
    
    # Simulate "Bridge" logic: Check if after hours (9 AM - 5 PM)
    now = datetime.datetime.now()
    if now.hour < 9 or now.hour >= 17:
        is_after_hours = True
    else:
        is_after_hours = False
        
    return jsonify({
        "status": "success",
        "message": "Your request has been received.",
        "after_hours": is_after_hours
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    # Use PORT from environment (for Render) or default to 80 (for your local link)
    port = int(os.environ.get('PORT', 80))
    app.run(host='0.0.0.0', port=port, debug=True)
