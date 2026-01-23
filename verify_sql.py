from app import app, db, User
import os

print("Verifying SQL Database Setup...")

# Ensure using a fresh db for test or just rely on verify
if os.path.exists('wellness.db'):
    print("Found existing wellness.db")

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
        else:
            print("User 'sql_test' already exists.")
            
        print("SQLAlchemy integration works!")
except Exception as e:
    print(f"FAILED: {e}")
