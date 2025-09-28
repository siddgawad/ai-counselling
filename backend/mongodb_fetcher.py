from pymongo import MongoClient
import os
from dotenv import load_dotenv

mongo_uri = os.getenv("MONGODB_URI")
mongo_uri  = os.getenv("MONGO_DB")
collection_name = os.getenv("MONGO_COLLECTION")

client = MongoClient(mongo_uri)
db = client[mongo_uri]

# ----------------- MongoDB connection -----------------



def fetch_all_from_mongo(collection_name: str, query: dict = None, limit: int = 0):
    """
    Fetch all documents (all fields) from a MongoDB collection and return as list of dicts.
    """
    query = query or {}
    collection = db[collection_name]
    cursor = collection.find(query) 
    if limit > 0:
        cursor = cursor.limit(limit)
    results = list(cursor)
    
    
    for doc in results:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
    return results
