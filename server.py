from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "your-secret-key-change-in-production-12345"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    emergency_contact: Optional[str] = None
    role: str = "tourist"  # tourist or admin

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class Zone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # safe, caution, danger
    coordinates: List[List[float]]  # [[lat, lng], ...]
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ZoneCreate(BaseModel):
    name: str
    type: str
    coordinates: List[List[float]]

class SOSAlert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    user_email: str
    latitude: float
    longitude: float
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "active"  # active or resolved

class SOSCreate(BaseModel):
    latitude: float
    longitude: float
    message: Optional[str] = None

class Feedback(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    rating: int  # 1-5
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FeedbackCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

# Utility functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Auth Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_dict = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "emergency_contact": user_data.emergency_contact,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user_id, "role": user_data.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": user_data.email,
            "name": user_data.name,
            "role": user_data.role
        }
    }

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }

@api_router.post("/admin/login", response_model=Token)
async def admin_login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email, "role": "admin"}, {"_id": 0})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }

# Location Routes
@api_router.post("/location/update")
async def update_location(location: LocationUpdate, current_user: dict = Depends(get_current_user)):
    location_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "latitude": location.latitude,
        "longitude": location.longitude,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.locations.insert_one(location_doc)
    
    # Update user's last known location
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "last_latitude": location.latitude,
            "last_longitude": location.longitude,
            "last_location_update": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Location updated successfully"}

# Weather Routes
@api_router.get("/weather")
async def get_weather(lat: float, lon: float):
    # Mock weather data (OpenWeatherMap API key not provided)
    return {
        "temperature": 22,
        "condition": "Partly Cloudy",
        "humidity": 65,
        "wind_speed": 12,
        "description": "Pleasant weather for traveling"
    }

# Zone Routes
@api_router.post("/zones", response_model=Zone)
async def create_zone(zone_data: ZoneCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create zones")
    
    zone_doc = {
        "id": str(uuid.uuid4()),
        "name": zone_data.name,
        "type": zone_data.type,
        "coordinates": zone_data.coordinates,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.zones.insert_one(zone_doc)
    
    zone_doc["created_at"] = datetime.fromisoformat(zone_doc["created_at"])
    return Zone(**zone_doc)

@api_router.get("/zones")
async def get_zones():
    zones = await db.zones.find({}, {"_id": 0}).to_list(1000)
    return zones

@api_router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete zones")
    
    result = await db.zones.delete_one({"id": zone_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone not found")
    
    return {"message": "Zone deleted successfully"}

# SOS Routes
@api_router.post("/sos", response_model=SOSAlert)
async def create_sos_alert(sos_data: SOSCreate, current_user: dict = Depends(get_current_user)):
    sos_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "latitude": sos_data.latitude,
        "longitude": sos_data.longitude,
        "message": sos_data.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.sos_alerts.insert_one(sos_doc)
    
    sos_doc["created_at"] = datetime.fromisoformat(sos_doc["created_at"])
    return SOSAlert(**sos_doc)

@api_router.get("/sos")
async def get_sos_alerts(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view SOS alerts")
    
    alerts = await db.sos_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return alerts

@api_router.patch("/sos/{sos_id}/resolve")
async def resolve_sos_alert(sos_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can resolve SOS alerts")
    
    result = await db.sos_alerts.update_one(
        {"id": sos_id},
        {"$set": {"status": "resolved"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    
    return {"message": "SOS alert resolved"}

# Feedback Routes
@api_router.post("/feedback", response_model=Feedback)
async def create_feedback(feedback_data: FeedbackCreate, current_user: dict = Depends(get_current_user)):
    feedback_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "rating": feedback_data.rating,
        "comment": feedback_data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.feedback.insert_one(feedback_doc)
    
    feedback_doc["created_at"] = datetime.fromisoformat(feedback_doc["created_at"])
    return Feedback(**feedback_doc)

@api_router.get("/feedback")
async def get_feedback(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view all feedback")
    
    feedback_list = await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return feedback_list

# Tourist Routes
@api_router.get("/tourists/active")
async def get_active_tourists(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view active tourists")
    
    # Get tourists who have updated location in the last 24 hours
    tourists = await db.users.find(
        {"role": "tourist", "last_location_update": {"$exists": True}},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    
    return tourists

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    # Create default admin user if not exists
    admin = await db.users.find_one({"email": "admin@tourist.com"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@tourist.com",
            "password": hash_password("admin123"),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("Default admin user created")
    
    # Create test tourist if not exists
    tourist = await db.users.find_one({"email": "tourist@test.com"})
    if not tourist:
        tourist_user = {
            "id": str(uuid.uuid4()),
            "email": "tourist@test.com",
            "password": hash_password("test123"),
            "name": "Test Tourist",
            "role": "tourist",
            "emergency_contact": "+1234567890",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(tourist_user)
        logger.info("Default tourist user created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()