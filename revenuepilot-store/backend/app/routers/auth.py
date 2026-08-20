from fastapi import APIRouter, HTTPException, status, Depends
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserOut
from app.core.security import verify_password, get_password_hash, create_access_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
async def register(user_in: UserRegister):
    existing_user = await User.find_one(User.email == user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
    
    hashed_password = get_password_hash(user_in.password)
    user = User(
        name=user_in.name,
        email=user_in.email,
        phone=user_in.phone,
        password_hash=hashed_password
    )
    await user.insert()
    
    access_token = create_access_token(subject=str(user.id))
    user_out = UserOut(
        id=str(user.id),
        name=user.name,
        email=user.email,
        phone=user.phone,
        created_at=user.created_at
    )
    
    return TokenResponse(access_token=access_token, token_type="bearer", user=user_out)

@router.post("/login", response_model=TokenResponse)
async def login(user_in: UserLogin):
    user = await User.find_one(User.email == user_in.email)
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(subject=str(user.id))
    user_out = UserOut(
        id=str(user.id),
        name=user.name,
        email=user.email,
        phone=user.phone,
        created_at=user.created_at
    )
    
    return TokenResponse(access_token=access_token, token_type="bearer", user=user_out)

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        created_at=current_user.created_at
    )
