import os
import re
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Tuple, List, Optional
from fastapi import HTTPException, UploadFile, status

from app.config import settings
from app.models.files import (
    ApprovedRootItem,
    ApprovedRootsResponse,
    FileItem,
    DirectoryListingResponse,
    FileOperationResponse,
)

logger = logging.getLogger("pocketdesk.files")

# Reserved Windows device names that cannot be created or accessed
WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}

# Regex for invalid directory/file name characters on Windows
INVALID_NAME_CHARS_RE = re.compile(r'[\x00-\x1f\\/:*?"<>|]')


class FileManager:
    """
    Secure restricted filesystem manager for PocketDesk.
    Enforces strict canonical path validation, prevents traversal/symlink escapes,
    filters sensitive system files/credentials, and respects upload size caps.
    """

    def get_roots(self) -> ApprovedRootsResponse:
        """Return list of currently approved root directories."""
        approved = settings.get_approved_roots()
        roots_list = [
            ApprovedRootItem(
                id=root_id,
                name=info["name"],
                display_path=info["display"],
            )
            for root_id, info in approved.items()
        ]
        return ApprovedRootsResponse(roots=roots_list)

    def resolve_safe_path(self, root_id: str, relative_path: str = "") -> Tuple[Path, Path]:
        """
        Resolve and strictly validate a user-supplied path against an approved root.
        
        Returns:
            Tuple[Path, Path]: (base_root_dir, resolved_target_path)
            
        Raises:
            HTTPException: If path traversal, symlink escape, or sensitive file access is detected.
        """
        approved = settings.get_approved_roots()
        if root_id not in approved:
            logger.warning("File access rejected: unapproved root_id '%s'", root_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Approved root '{root_id}' is not configured or recognized.",
            )

        root_info = approved[root_id]
        base_dir = Path(root_info["path"]).resolve()
        if not base_dir.exists() or not base_dir.is_dir():
            logger.error("Configured approved root '%s' does not exist on disk: %s", root_id, base_dir)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Approved root folder '{root_info['name']}' is not accessible on host.",
            )

        # Reject null bytes
        if "\x00" in relative_path:
            logger.warning("Malicious path attempt: null byte in path '%s'", relative_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid path: null byte detected.",
            )

        raw_trimmed = relative_path.strip()

        # Check for absolute root, Windows drive letters, or UNC shares
        if (
            raw_trimmed.startswith("/")
            or raw_trimmed.startswith("\\")
            or re.match(r"^[a-zA-Z]:", raw_trimmed)
            or raw_trimmed.startswith("//")
            or raw_trimmed.startswith("\\\\")
        ):
            logger.warning("Malicious path attempt: absolute drive/UNC/root path '%s'", raw_trimmed)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Absolute filesystem paths are prohibited.",
            )

        # Normalize separators
        clean_rel = raw_trimmed.replace("\\", "/").strip()

        # Resolve candidate
        try:
            if not clean_rel:
                candidate = base_dir
            else:
                candidate = (base_dir / clean_rel).resolve()
        except Exception as exc:
            logger.warning("Path resolution error for '%s': %s", clean_rel, exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid path structure.",
            )

        # 1. Path Traversal Check (Must be relative to base_dir)
        try:
            if not (candidate == base_dir or candidate.is_relative_to(base_dir)):
                logger.warning(
                    "Path traversal attempt blocked: candidate '%s' outside base '%s'",
                    candidate, base_dir
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Path traversal outside approved root detected.",
                )
        except AttributeError:
            # Fallback for Python versions where is_relative_to might raise
            try:
                candidate.relative_to(base_dir)
            except ValueError:
                logger.warning("Path traversal attempt blocked: '%s'", candidate)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Path traversal outside approved root detected.",
                )

        # 2. Symlink Escape Check
        # If candidate or any part of the path is a symlink, verify realpath is also within base_dir
        try:
            real_path = Path(os.path.realpath(str(candidate)))
            if not (real_path == base_dir or real_path.is_relative_to(base_dir)):
                logger.warning(
                    "Symlink escape blocked: '%s' resolves to outside root '%s'",
                    candidate, real_path
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Symlink target is outside approved root directory.",
                )
        except Exception as exc:
            if isinstance(exc, HTTPException):
                raise exc
            logger.warning("Symlink verification error: %s", exc)

        # 3. Sensitive Patterns & Extensions Filtering
        self._check_sensitive_patterns(candidate, base_dir)

        return base_dir, candidate

    def _check_sensitive_patterns(self, candidate: Path, base_dir: Path) -> None:
        """Ensure path does not touch credentials, system files, or blacklisted extensions."""
        # Check all parts of path relative to base_dir
        rel_parts = candidate.relative_to(base_dir).parts
        for part in rel_parts:
            lowered = part.lower().strip()
            # Direct match or substring match for sensitive directory/file names
            for pat in settings.SENSITIVE_PATTERNS:
                if lowered == pat or lowered.startswith(pat + ".") or f"/{pat}/" in f"/{lowered}/":
                    logger.warning("Blocked access to sensitive pattern '%s' in '%s'", pat, candidate)
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: Access to protected system or credential file is prohibited.",
                    )

        # Check extension for files
        suffix = candidate.suffix.lower()
        if suffix in settings.SENSITIVE_EXTENSIONS:
            logger.warning("Blocked access to dangerous/sensitive file extension '%s' in '%s'", suffix, candidate)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Files with extension '{suffix}' cannot be accessed or transferred.",
            )

    def list_directory(self, root_id: str, relative_path: str = "") -> DirectoryListingResponse:
        """List files and subdirectories within an approved directory."""
        base_dir, target = self.resolve_safe_path(root_id, relative_path)
        approved = settings.get_approved_roots()
        root_name = approved[root_id]["name"]

        if not target.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requested directory does not exist.",
            )

        if not target.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target path is a file, not a directory.",
            )

        items: List[FileItem] = []
        try:
            for entry in target.iterdir():
                lowered_name = entry.name.lower().strip()

                # Filter out sensitive patterns
                if any(lowered_name == pat or lowered_name.startswith(pat + ".") for pat in settings.SENSITIVE_PATTERNS):
                    continue

                # Filter out sensitive extensions
                if entry.suffix.lower() in settings.SENSITIVE_EXTENSIONS:
                    continue

                # Verify symlinks
                try:
                    if entry.is_symlink():
                        real_target = Path(os.path.realpath(str(entry)))
                        if not (real_target == base_dir or real_target.is_relative_to(base_dir)):
                            continue
                except Exception:
                    continue

                # Metadata extraction
                try:
                    stat_info = entry.stat()
                    is_directory = entry.is_dir()
                    size_bytes = stat_info.st_size if not is_directory else 0
                    mtime = datetime.fromtimestamp(stat_info.st_mtime, tz=timezone.utc).isoformat()
                    
                    # Hidden check (name starts with dot or Windows hidden attribute)
                    is_hidden = entry.name.startswith(".")
                    if hasattr(stat_info, "st_file_attributes"):
                        is_hidden = is_hidden or bool(stat_info.st_file_attributes & 2)

                    rel_item_path = str(entry.relative_to(base_dir)).replace("\\", "/")
                    ext = entry.suffix.lstrip(".").lower() if not is_directory else ""

                    items.append(
                        FileItem(
                            name=entry.name,
                            path=rel_item_path,
                            is_dir=is_directory,
                            size_bytes=size_bytes,
                            modified_at=mtime,
                            extension=ext,
                            is_hidden=is_hidden,
                        )
                    )
                except (PermissionError, FileNotFoundError):
                    # Skip unreadable system/locked items
                    continue
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied accessing this directory.",
            )

        # Sort: Directories first (alphabetical), then files (alphabetical)
        items.sort(key=lambda x: (not x.is_dir, x.name.lower()))

        # Parent path calculation
        curr_rel = str(target.relative_to(base_dir)).replace("\\", "/") if target != base_dir else ""
        parent_rel: Optional[str] = None
        if target != base_dir:
            parent_path_obj = target.parent
            parent_rel = str(parent_path_obj.relative_to(base_dir)).replace("\\", "/") if parent_path_obj != base_dir else ""

        return DirectoryListingResponse(
            root_id=root_id,
            root_name=root_name,
            current_path=curr_rel,
            parent_path=parent_rel,
            items=items,
            can_upload=True,
            can_create_folder=settings.ENABLE_FOLDER_CREATION,
        )

    def get_download_file(self, root_id: str, relative_path: str) -> Tuple[Path, str, int]:
        """Validate and prepare a file for secure download."""
        base_dir, target = self.resolve_safe_path(root_id, relative_path)

        if not target.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requested file does not exist.",
            )

        if not target.is_file():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requested path is a directory, not a downloadable file.",
            )

        try:
            file_size = target.stat().st_size
        except Exception:
            file_size = 0

        return target, target.name, file_size

    async def upload_file(self, root_id: str, relative_path: str, upload: UploadFile) -> FileOperationResponse:
        """Save an uploaded file into an approved destination directory with strict size caps."""
        base_dir, dest_dir = self.resolve_safe_path(root_id, relative_path)

        if not dest_dir.exists() or not dest_dir.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Destination upload directory does not exist.",
            )

        # Sanitize uploaded filename
        raw_name = Path(upload.filename or "upload.bin").name
        safe_name = INVALID_NAME_CHARS_RE.sub("_", raw_name).strip()
        if not safe_name or safe_name in (".", ".."):
            safe_name = f"upload_{int(datetime.now().timestamp())}.bin"

        # Check reserved Windows names
        stem_upper = Path(safe_name).stem.upper()
        if stem_upper in WINDOWS_RESERVED_NAMES:
            safe_name = f"file_{safe_name}"

        # Check sensitive extensions
        ext = Path(safe_name).suffix.lower()
        if ext in settings.SENSITIVE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Upload rejected: Files with extension '{ext}' are prohibited for security.",
            )

        target_file = dest_dir / safe_name

        # Ensure target file doesn't escape
        base_dir, verified_file = self.resolve_safe_path(root_id, f"{relative_path}/{safe_name}".strip("/"))

        # Stream upload with size cap
        max_bytes = settings.MAX_UPLOAD_SIZE_BYTES
        total_bytes = 0
        chunk_size = 64 * 1024  # 64 KB chunks

        try:
            with open(verified_file, "wb") as f_out:
                while True:
                    chunk = await upload.read(chunk_size)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > max_bytes:
                        # Exceeded size limit: delete partial file and reject
                        f_out.close()
                        if verified_file.exists():
                            verified_file.unlink(missing_ok=True)
                        logger.warning(
                            "Upload rejected: size exceeded limit of %s bytes (got %s bytes)",
                            max_bytes, total_bytes
                        )
                        raise HTTPException(
                            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                            detail=f"Upload exceeded maximum allowed file size limit ({max_bytes // (1024 * 1024)} MB).",
                        )
                    f_out.write(chunk)
        except Exception as exc:
            if verified_file.exists() and total_bytes > max_bytes:
                verified_file.unlink(missing_ok=True)
            if isinstance(exc, HTTPException):
                raise exc
            logger.error("Error writing uploaded file: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save uploaded file on host.",
            )

        rel_saved_path = str(verified_file.relative_to(base_dir)).replace("\\", "/")
        logger.info("File uploaded successfully: '%s' (%s bytes)", rel_saved_path, total_bytes)
        return FileOperationResponse(
            success=True,
            message="File uploaded successfully.",
            path=rel_saved_path,
            size_bytes=total_bytes,
        )

    def create_folder(self, root_id: str, relative_path: str, folder_name: str) -> FileOperationResponse:
        """Create a new folder within an approved directory."""
        if not settings.ENABLE_FOLDER_CREATION:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Folder creation is disabled by host configuration.",
            )

        # Validate folder name
        clean_name = folder_name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Folder name cannot be empty.",
            )

        if len(clean_name) > 120:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Folder name exceeds maximum length of 120 characters.",
            )

        if INVALID_NAME_CHARS_RE.search(clean_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Folder name contains illegal filesystem characters (\\ / : * ? \" < > |).",
            )

        if clean_name in (".", "..") or clean_name.endswith("."):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Folder name cannot be relative navigators or end with a period.",
            )

        if clean_name.upper() in WINDOWS_RESERVED_NAMES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{clean_name}' is a reserved Windows device name.",
            )

        # Ensure parent path is valid
        base_dir, parent_dir = self.resolve_safe_path(root_id, relative_path)
        if not parent_dir.exists() or not parent_dir.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent directory does not exist.",
            )

        # Resolve target new folder
        target_subpath = f"{relative_path}/{clean_name}".strip("/")
        base_dir, new_folder = self.resolve_safe_path(root_id, target_subpath)

        if new_folder.exists():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A folder or file named '{clean_name}' already exists in this location.",
            )

        try:
            new_folder.mkdir(parents=False, exist_ok=False)
        except Exception as exc:
            logger.error("Failed to create folder '%s': %s", new_folder, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create directory: {exc}",
            )

        rel_created = str(new_folder.relative_to(base_dir)).replace("\\", "/")
        logger.info("Created new folder: '%s'", rel_created)
        return FileOperationResponse(
            success=True,
            message=f"Folder '{clean_name}' created successfully.",
            path=rel_created,
        )


file_manager = FileManager()
