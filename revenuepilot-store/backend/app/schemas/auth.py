from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=24)
    password: str = Field(min_length=12, max_length=72)

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    role: Literal["customer", "merchant", "admin"]
    merchant_id: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
