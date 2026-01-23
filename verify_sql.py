from app import app, db, User
import os

print("Verifying SQL Database Setup (v2)...")

if os.path.exists('wellness_sql.db'):
    print("Deleting old wellness_sql.db...")
    os.remove('wellness_sql.db')

try:
    with app.app_context():
        db.create_all()
        print("Tables created.")
        
        # Test creating a user
        if not User.query.filter_by(username='sql_test').first():
            u = User(username='sql_test', email='test@sql.com', password_hash='hash')
            db.session.add(u)
            db.session.commit()
            print("User 'sql_test' created successfully.")
            
            # Verify retrieval
            u_db = User.query.filter_by(username='sql_test').first()
            print(f"Retrieved user: {u_db.username}, Created At: {u_db.created_at}")
        else:
            print("User 'sql_test' already exists.")
            
        print("SQLAlchemy integration works!")
except Exception as e:
    print(f"FAILED: {e}")
