import mimetypes
from typing import Optional
from fastapi import APIRouter, Depends, Query, Form, UploadFile, File, HTTPException, status
from fastapi.responses import FileResponse

from app.dependencies.auth import require_auth
from app.services.file_manager import file_manager
from app.models.files import (
    ApprovedRootsResponse,
    DirectoryListingResponse,
    CreateFolderRequest,
    FileOperationResponse,
)

router = APIRouter(prefix="/api/files", tags=["File Management"])


@router.get(
    "/roots",
    response_model=ApprovedRootsResponse,
    summary="List approved root directories",
    description="Returns explicitly allowlisted filesystem roots (Downloads, Documents, Desktop, etc.).",
)
async def get_roots(token: str = Depends(require_auth)) -> ApprovedRootsResponse:
    """Return approved root directories."""
    return file_manager.get_roots()


@router.get(
    "/list",
    response_model=DirectoryListingResponse,
    summary="List directory contents",
    description="Lists files and folders within an approved directory. Rejects path traversal and symlink escapes.",
)
async def list_files(
    root_id: str = Query(..., description="Approved root identifier"),
    path: str = Query("", description="Relative path within the root directory"),
    token: str = Depends(require_auth),
) -> DirectoryListingResponse:
    """List directory items with metadata."""
    return file_manager.list_directory(root_id, path)


@router.get(
    "/download",
    summary="Download an approved file",
    description="Downloads a file from an approved directory. Disallows traversal, system files, and sensitive credentials.",
)
async def download_file(
    root_id: str = Query(..., description="Approved root identifier"),
    path: str = Query(..., description="Relative path to target file"),
    token: str = Depends(require_auth),
):
    """Stream authorized file to authenticated client."""
    file_path, file_name, file_size = file_manager.get_download_file(root_id, path)

    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        filename=file_name,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
            "Content-Length": str(file_size),
        },
    )


@router.post(
    "/upload",
    response_model=FileOperationResponse,
    summary="Upload a file to an approved destination",
    description="Saves uploaded file to approved directory. Enforces size limits and prevents traversal.",
)
async def upload_file(
    root_id: str = Form(..., description="Approved root identifier"),
    path: str = Form("", description="Relative directory destination"),
    file: UploadFile = File(..., description="Binary file upload"),
    token: str = Depends(require_auth),
) -> FileOperationResponse:
    """Receive and securely store uploaded file."""
    return await file_manager.upload_file(root_id, path, file)


@router.post(
    "/mkdir",
    response_model=FileOperationResponse,
    summary="Create a new folder",
    description="Creates a new subdirectory within an approved directory with strict naming validation.",
)
async def create_folder(
    body: CreateFolderRequest,
    token: str = Depends(require_auth),
) -> FileOperationResponse:
    """Create a new folder."""
    return file_manager.create_folder(body.root_id, body.path, body.folder_name)
