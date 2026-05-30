import hashlib

import bcrypt


def hash_password(plain: str) -> str:
    """bcrypt でパスワードをハッシュ化する。"""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, stored: str) -> bool:
    """保存形式を判別してパスワードを検証する。

    - bcrypt 形式 ($2b$...): bcrypt で検証
    - 旧 SHA256 形式 (salt:digest): 既存ユーザー救済のため従来ロジックで検証
    """
    if stored.startswith("$2"):
        try:
            return bcrypt.checkpw(plain.encode(), stored.encode())
        except ValueError:
            return False
    # 旧形式: "salt:digest"
    salt, _, digest = stored.partition(":")
    if not digest:
        return False
    return hashlib.sha256(f"{salt}:{plain}".encode()).hexdigest() == digest
