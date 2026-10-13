from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str | None) -> bool:
    if hashed_password is None:
        password_hash.verify(password, password_hash.hash("non-matching-password"))
        return False
    return password_hash.verify(password, hashed_password)
