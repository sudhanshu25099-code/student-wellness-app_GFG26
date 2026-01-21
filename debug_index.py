import os
from google.cloud import firestore

# Use the correct Project ID and Database
project_id = "ethereal-creek-484805-f2"
db_name = "student-wellness"

print(f"Connecting to DB: {db_name}...")
db = firestore.Client(project=project_id, database=db_name)

print("Attempting to query stress_logs (Requires Index)...")
try:
    # Mimic the app's query: WHERE user_id == ... ORDER BY timestamp DESC
    logs_ref = db.collection('stress_logs')
    query = logs_ref.where('user_id', '==', 'test_user').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(7)
    
    results = list(query.stream())
    print("Query SUCCESS! (Index exists)")
    
except Exception as e:
    print(f"\nQuery FAILED!")
    print(f"Error: {e}")
    # The error message usually contains a URL to create the index
