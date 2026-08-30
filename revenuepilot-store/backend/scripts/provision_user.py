"""Explicit CLI provisioning for merchant and admin accounts.

Usage: python scripts/provision_user.py --email owner@example.com --role merchant
"""
import argparse
import asyncio
import getpass

from app.core.security import get_password_hash
from app.db.mongodb import close_db, init_db
from app.models.user import User


async def provision(args: argparse.Namespace) -> None:
    password = getpass.getpass("Password (minimum 12 characters): ")
    if len(password) < 12 or len(password.encode("utf-8")) > 72:
        raise ValueError("Password must be 12-72 UTF-8 bytes.")
    await init_db()
    try:
        if await User.find_one(User.email == args.email.lower()):
            raise ValueError("A user with that email already exists.")
        user = User(
            name=args.name,
            email=args.email.lower(),
            phone=args.phone,
            password_hash=get_password_hash(password),
            role=args.role,
            merchant_id=args.merchant_id,
        )
        await user.insert()
        print(f"Provisioned {args.role} account {user.email} for merchant {args.merchant_id}.")
    finally:
        await close_db()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--phone", required=True)
    parser.add_argument("--merchant-id", required=True)
    parser.add_argument("--role", choices=("merchant", "admin"), required=True)
    asyncio.run(provision(parser.parse_args()))
