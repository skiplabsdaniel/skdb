from flask import Flask, json, request, redirect
import psycopg2
import requests

REACTIVE_SERVICE_URL = "http://reactive_cache:8081/v1"


def get_db():
    conn = psycopg2.connect(
        host="db",
        user="postgres",
        password="change_me",
    )

    return conn


app = Flask(__name__)


def format_post(post):
    return {
        "id": post[0],
        "title": post[1],
        "url": post[2],
        "body": post[3],
        "author": post[4],
        "upvotes": post[5],
    }


@app.get("/posts")
def posts_index():
    # # Non-reactive version:
    # db = get_db()
    # cur = db.execute(
    #     """SELECT id, title, url, body,
    #     (SELECT name FROM users WHERE id=posts.author_id LIMIT 1) as author,
    #     (SELECT COUNT(id) FROM upvotes WHERE post_id=posts.id) as upvotes
    #     FROM posts ORDER BY upvotes DESC"""
    # )
    # res = [
    #     format_post(post)
    #     for post in cur.fetchall()
    # ]
    # cur.close()

    # return json.jsonify(res)

    if "text/event-stream" in request.accept_mimetypes:
        resp = requests.post(
            f"{REACTIVE_SERVICE_URL}/streams/posts",
            json=10,
        )
        uuid = resp.text

        return redirect(f"/streams/{uuid}", code=307)

    else:
        resp = requests.post(
            f"{REACTIVE_SERVICE_URL}/snapshot/posts",
            json=10,
        )

        # The reactive service returns an array of (id, values) where
        # values is an array of objects. Here, as in many cases, the
        # values consists of a single object (which already contains
        # the `id` key).
        return resp.json()[0][1]


@app.post("/posts")
def create_post():
    params = request.json
    title = params["title"]
    url = params["url"]
    body = params["body"]
    author_id = 1

    with get_db() as db:
        with db.cursor() as cur:
            cur.execute(
                f"INSERT INTO posts(title, url, body, author_id) VALUES('{title}', '{url}', '{body}', '{author_id}') RETURNING id"
            )
            post_id = cur.fetchone()[0]
            db.commit()

    return "ok", 200


@app.delete("/posts/<int:post_id>")
def delete_post(post_id):
    with get_db() as db:
        with db.cursor() as cur:
            # Get all upvote IDs related to the post.
            cur.execute(f"SELECT id FROM upvotes WHERE post_id={post_id}")
            upvote_ids = [row[0] for row in cur.fetchall()]

            # Delete upvotes related to the post.
            cur.execute(f"DELETE FROM upvotes WHERE post_id={post_id}")
            # Delete the post.
            cur.execute(f"DELETE FROM posts WHERE id={post_id}")
            db.commit()
    return "ok", 200


@app.put("/posts/<int:post_id>")
def update_post(post_id):
    params = request.json
    title = params["title"]
    url = params["url"]
    body = params["body"]

    with get_db() as db:
        with db.cursor() as cur:
            cur.execute(
                f"UPDATE posts SET title='{title}', url='{url}', body='{body}' WHERE id={post_id}"
            )
            db.commit()

    return "ok", 200


@app.post("/posts/<int:post_id>/upvotes")
def upvote_post(post_id):
    # TODO
    # user_id = get_current_user().id
    user_id = 0

    with get_db() as db:
        with db.cursor() as cur:
            cur.execute(
                f"INSERT INTO upvotes(post_id, user_id) VALUES({post_id}, {user_id}) RETURNING id"
            )
            upvote_id = cur.fetchone()[0]
            db.commit()

    return "ok", 200


@app.get("/healthcheck")
def healthcheck():
    return "ok", 200
