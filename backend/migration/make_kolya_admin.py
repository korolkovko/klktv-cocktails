import os
from sqlalchemy import create_engine, text
def run(url):
    e = create_engine(url)
    with e.begin() as c:
        c.execute(text("UPDATE users SET role='admin' WHERE username='kolya'"))
        print("kolya role:", c.execute(text("SELECT role FROM users WHERE username='kolya'")).scalar())
if __name__ == "__main__":
    run(os.environ["DEST_DATABASE_URL"])
