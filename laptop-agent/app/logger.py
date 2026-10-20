import logging
import sys
from app.config import settings

def setup_logging() -> None:
    """Configures structured standard logging for PocketDesk agent."""
    log_format = "%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    
    level = getattr(logging, settings.LOG_LEVEL, logging.INFO)
    
    logging.basicConfig(
        level=level,
        format=log_format,
        datefmt=date_format,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Silence overly verbose third-party loggers if needed
    logging.getLogger("uvicorn.access").setLevel(level)
