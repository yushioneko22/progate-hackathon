import hashlib
import os


def hash_password(plain: str) -> str:
    salt = os.urandom(16).hex()
    digest = hashlib.sha256(f"{salt}:{plain}".encode()).hexdigest()
    return f"{salt}:{digest}"


def verify_password(plain: str, stored: str) -> bool:
    salt, digest = stored.split(":", 1)
    return hashlib.sha256(f"{salt}:{plain}".encode()).hexdigest() == digest
