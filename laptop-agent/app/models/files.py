from typing import List, Optional
from pydantic import BaseModel, Field


class ApprovedRootItem(BaseModel):
    id: str = Field(..., description="Unique identifier for the approved root directory")
    name: str = Field(..., description="Human-friendly label (e.g. Downloads, Documents)")
    display_path: str = Field(..., description="Sanitized display path shown to the user")


class ApprovedRootsResponse(BaseModel):
    roots: List[ApprovedRootItem] = Field(..., description="List of approved accessible directories")


class FileItem(BaseModel):
    name: str = Field(..., description="File or folder name")
    path: str = Field(..., description="Relative path within the root directory")
    is_dir: bool = Field(..., description="True if item is a directory, False if regular file")
    size_bytes: int = Field(0, description="Size of file in bytes (0 for directories)")
    modified_at: str = Field(..., description="ISO 8601 modification timestamp")
    extension: str = Field("", description="File extension without leading dot")
    is_hidden: bool = Field(False, description="Whether the file/directory has the hidden attribute")


class DirectoryListingResponse(BaseModel):
    root_id: str = Field(..., description="Active approved root identifier")
    root_name: str = Field(..., description="Active approved root display name")
    current_path: str = Field("", description="Current relative path within the root (empty for root top-level)")
    parent_path: Optional[str] = Field(None, description="Relative path to parent directory, or None if at top-level")
    items: List[FileItem] = Field(default_factory=list, description="Files and folders in current directory")
    can_upload: bool = Field(True, description="Whether file uploading is permitted in this directory")
    can_create_folder: bool = Field(True, description="Whether folder creation is permitted in this directory")


class CreateFolderRequest(BaseModel):
    root_id: str = Field(..., description="Approved root identifier")
    path: str = Field("", description="Relative parent directory path")
    folder_name: str = Field(..., min_length=1, max_length=120, description="Name of new folder to create")


class FileOperationResponse(BaseModel):
    success: bool = Field(..., description="Operation status")
    message: str = Field(..., description="Human-readable result or status message")
    path: Optional[str] = Field(None, description="Relative path of affected file/folder")
    size_bytes: Optional[int] = Field(None, description="Size of uploaded/created item")
