"""CLI entry point for running the PocketDesk Laptop Agent."""
import argparse
import sys
import uvicorn

from app.config import settings


def parse_args():
    parser = argparse.ArgumentParser(
        description="PocketDesk Windows 10/11 Laptop Agent"
    )
    parser.add_argument(
        "--host",
        type=str,
        default=settings.HOST,
        help="Host address to bind to (Default: 127.0.0.1 for local security)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=settings.PORT,
        help="Port number to listen on (Default: 8000)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=settings.RELOAD,
        help="Enable auto-reload on code modifications",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    
    # Enforce or warn on binding
    if args.host not in ("127.0.0.1", "localhost", "::1"):
        print(
            f"WARNING: Binding to '{args.host}'. "
            "Stage 2 agent is designed for local-only use. Never expose to public internet!",
            file=sys.stderr,
        )

    print(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} on http://{args.host}:{args.port}")
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=settings.LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    main()
