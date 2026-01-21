import os
from google.cloud import firestore

project_id = "ethereal-creek-484805-f2"
print(f"Testing Firestore connection for project: {project_id}")

try:
    db = firestore.Client(project=project_id, database='student-wellness')
    print("Firestore Client initialized.")
    
    # Try to write a test document
    doc_ref = db.collection('test_connection').document('ping')
    doc_ref.set({'message': 'pong', 'timestamp': firestore.SERVER_TIMESTAMP})
    print("Write successful.")
    
    # Try to read it back
    doc = doc_ref.get()
    if doc.exists:
        print(f"Read successful: {doc.to_dict()}")
    else:
        print("Read failed: Document not found.")
        
    print("Firestore is WORKING.")
    
except Exception as e:
    print(f"\nFirestore connection FAILED.\nError: {e}")
