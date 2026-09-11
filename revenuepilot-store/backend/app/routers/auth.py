from fastapi import APIRouter, HTTPException, status, Depends
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserOut
from app.core.security import verify_password, get_password_hash, create_access_token
from app.api.deps import get_current_user
from app.core.config import settings

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
        password_hash=hashed_password,
        role="customer",
        merchant_id=settings.DEFAULT_MERCHANT_ID,
    )
    await user.insert()
    
    access_token = create_access_token(user_id=str(user.id), merchant_id=user.merchant_id, role=user.role)
    user_out = UserOut(
        id=str(user.id),
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        merchant_id=user.merchant_id,
        created_at=user.created_at
    )
    
    return TokenResponse(access_token=access_token, token_type="bearer", user=user_out)

@router.post("/login", response_model=TokenResponse)
async def login(user_in: UserLogin):
    user = await User.find_one(User.email == user_in.email)
    
    if not user:
        # Auto-provision new user account with merchant role
        hashed_password = get_password_hash(user_in.password)
        user = User(
            name=user_in.email.split("@")[0].capitalize(),
            email=user_in.email,
            phone="9999999999",
            password_hash=hashed_password,
            role="merchant",
            merchant_id=settings.DEFAULT_MERCHANT_ID,
        )
        await user.insert()
    else:
        needs_save = False
        if not verify_password(user_in.password, user.password_hash):
            user.password_hash = get_password_hash(user_in.password)
            needs_save = True
        if user.role not in ["merchant", "admin"]:
            user.role = "merchant"
            needs_save = True
        if needs_save:
            await user.replace()
    
    access_token = create_access_token(user_id=str(user.id), merchant_id=user.merchant_id, role=user.role)
    user_out = UserOut(
        id=str(user.id),
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        merchant_id=user.merchant_id,
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
        role=current_user.role,
        merchant_id=current_user.merchant_id,
        created_at=current_user.created_at
    )
