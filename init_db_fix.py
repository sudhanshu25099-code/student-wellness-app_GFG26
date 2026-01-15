import app
from app import db, StressLog

print("Initializing Database...")
with app.app.app_context():
    try:
        # This will create the StressLog table if it doesn't exist
        db.create_all()
        print("Database tables created successfully.")
        
        # Verify if table exists by trying to query it
        try:
            count = StressLog.query.count()
            print(f"Current StressLog entries: {count}")
        except Exception as e:
            print(f"Error querying StressLog: {e}")
            
    except Exception as e:
        print(f"Error creating tables: {e}")

print("Done. You may need to restart your Flask server for changes to take effect.")
