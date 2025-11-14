from waitress import serve

from app import app


def main():
    host = "0.0.0.0"
    port = 8000
    serve(app, listen=f"{host}:{port}")


if __name__ == "__main__":
    main()
