"""CLI entry point for running the PocketDesk Laptop Agent."""
import argparse
import sys
import uvicorn

from app.config import settings
from app.services.auth import AuthService


def parse_args():
    parser = argparse.ArgumentParser(
        description="PocketDesk Windows 10/11 Laptop Agent"
    )
    parser.add_argument(
        "--host",
        type=str,
        default=settings.HOST,
        help="Host address to bind to (Default: 127.0.0.1)",
    )
    parser.add_argument(
        "--lan",
        action="store_true",
        help="Bind to 0.0.0.0 to allow connections from your phone on the local Wi-Fi network",
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

    # If --lan is supplied, bind to 0.0.0.0
    bind_host = "0.0.0.0" if args.lan else args.host
    settings.HOST = bind_host
    settings.PORT = args.port

    # Initialize pairing code upfront so it displays prominently
    pairing_code = AuthService.initialize_pairing_code()

    lan_ips = settings.get_local_lan_ips()
    primary_ip = lan_ips[0] if lan_ips else "127.0.0.1"

    print("==================================================")
    print(f"  {settings.APP_NAME} v{settings.APP_VERSION} (Stage {settings.STAGE})")
    if bind_host == "0.0.0.0":
        print(f"  Mode: Local Wi-Fi Network Access enabled")
        print(f"  Listening on all interfaces: http://0.0.0.0:{args.port}")
        print(f"  Phone Connection URL: http://{primary_ip}:{args.port}")
    else:
        print(f"  Mode: Localhost only")
        print(f"  Listening on: http://127.0.0.1:{args.port}")
        print("  Tip: To connect from your phone over Wi-Fi, run: python run.py --lan")
    print("--------------------------------------------------")
    print(f"  >> PAIRING PIN: {pairing_code} <<")
    print("  Enter this 6-digit PIN on your phone to connect.")
    print("==================================================")

    uvicorn.run(
        "app.main:app",
        host=bind_host,
        port=args.port,
        reload=args.reload,
        log_level=settings.LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    main()
