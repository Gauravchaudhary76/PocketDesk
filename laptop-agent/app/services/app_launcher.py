import os
import shutil
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import HTTPException, status

from app.models.apps import AllowlistedAppItem, AppAllowlistResponse, LaunchAppResponse

logger = logging.getLogger("pocketdesk.apps")


class AppLauncher:
    """
    Allowlist-restricted application launcher for PocketDesk.
    Executes only verified predefined executables on the host.
    Rejects any arbitrary executable paths, shell strings, or command injection vectors.
    """

    def __init__(self) -> None:
        self._allowlist = self._initialize_allowlist()
        self._launched_processes: List[Dict[str, any]] = []

    def _initialize_allowlist(self) -> Dict[str, Dict[str, any]]:
        """
        Build the approved applications allowlist with known safe paths on Windows.
        """
        system32 = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32"
        program_files_x86 = Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"))
        local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))

        return {
            "notepad": {
                "name": "Notepad",
                "description": "Windows standard plain text editor",
                "executable": str(system32 / "notepad.exe"),
                "fallback_cmd": "notepad.exe",
                "icon_name": "file-text",
                "is_disruptive": False,
            },
            "calc": {
                "name": "Calculator",
                "description": "Windows built-in calculator utility",
                "executable": str(system32 / "calc.exe"),
                "fallback_cmd": "calc.exe",
                "icon_name": "calculator",
                "is_disruptive": False,
            },
            "mspaint": {
                "name": "Paint",
                "description": "Simple graphics and drawing editor",
                "executable": str(system32 / "mspaint.exe"),
                "fallback_cmd": "mspaint.exe",
                "icon_name": "palette",
                "is_disruptive": False,
            },
            "explorer": {
                "name": "File Explorer",
                "description": "Windows desktop file browser",
                "executable": str(Path(os.environ.get("SystemRoot", r"C:\Windows")) / "explorer.exe"),
                "fallback_cmd": "explorer.exe",
                "icon_name": "folder",
                "is_disruptive": False,
            },
            "edge": {
                "name": "Microsoft Edge",
                "description": "Default Windows web browser",
                "executable": str(program_files_x86 / "Microsoft" / "Edge" / "Application" / "msedge.exe"),
                "fallback_cmd": "msedge.exe",
                "icon_name": "globe",
                "is_disruptive": False,
            },
            "code": {
                "name": "Visual Studio Code",
                "description": "Code and script editor",
                "executable": str(local_app_data / "Programs" / "Microsoft VS Code" / "Code.exe"),
                "fallback_cmd": "code.cmd",
                "icon_name": "code",
                "is_disruptive": False,
            },
            "taskmgr": {
                "name": "Task Manager",
                "description": "System resource and task inspector",
                "executable": str(system32 / "taskmgr.exe"),
                "fallback_cmd": "taskmgr.exe",
                "icon_name": "activity",
                "is_disruptive": True,
            },
            "terminal": {
                "name": "Windows Terminal / PowerShell",
                "description": "Interactive command line environment",
                "executable": str(Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"),
                "fallback_cmd": "powershell.exe",
                "icon_name": "terminal",
                "is_disruptive": True,
            },
        }

    def _resolve_executable(self, app_info: Dict[str, any]) -> Optional[str]:
        """Locate real executable path on host."""
        candidate = Path(app_info["executable"])
        if candidate.exists() and candidate.is_file():
            return str(candidate)

        # Fallback to which/PATH
        which_path = shutil.which(app_info.get("fallback_cmd", ""))
        if which_path:
            return which_path

        return None

    def get_allowlist(self) -> AppAllowlistResponse:
        """Return list of allowlisted applications with installation status."""
        items: List[AllowlistedAppItem] = []
        for app_id, info in self._allowlist.items():
            resolved = self._resolve_executable(info)
            items.append(
                AllowlistedAppItem(
                    app_id=app_id,
                    name=info["name"],
                    description=info["description"],
                    icon_name=info["icon_name"],
                    is_disruptive=info["is_disruptive"],
                    is_installed=resolved is not None,
                )
            )
        return AppAllowlistResponse(apps=items)

    def launch_app(self, app_id: str, confirmed: bool = False) -> LaunchAppResponse:
        """
        Safely launch an allowlisted application by ID.
        Rejects arbitrary executable paths, non-allowlisted apps, or disruptive apps without confirmation.
        """
        if app_id not in self._allowlist:
            logger.warning("Rejected launch request for non-allowlisted app_id: '%s'", app_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Application '{app_id}' is not in the approved allowlist.",
            )

        app_info = self._allowlist[app_id]

        # Require explicit confirmation for disruptive applications
        if app_info["is_disruptive"] and not confirmed:
            logger.warning("Launch of disruptive app '%s' rejected: confirmation missing", app_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Confirmation required: Launching '{app_info['name']}' requires explicit authorization.",
            )

        exe_path = self._resolve_executable(app_info)
        if not exe_path:
            logger.error("Allowlisted app '%s' is not installed or found on host: %s", app_id, app_info["executable"])
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application '{app_info['name']}' is not installed or accessible on this host.",
            )

        try:
            # Strictly shell=False to prevent command injection
            process = subprocess.Popen(
                [exe_path],
                shell=False,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )

            record = {
                "app_id": app_id,
                "name": app_info["name"],
                "pid": process.pid,
                "launched_at": datetime.now(timezone.utc).isoformat(),
            }
            self._launched_processes.append(record)
            if len(self._launched_processes) > 50:
                self._launched_processes.pop(0)

            logger.info("Successfully launched allowlisted application '%s' (PID: %s)", app_id, process.pid)
            return LaunchAppResponse(
                success=True,
                message=f"Application '{app_info['name']}' launched successfully.",
                app_id=app_id,
                pid=process.pid,
            )

        except Exception as exc:
            logger.error("Failed to spawn allowlisted app '%s': %s", app_id, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to launch application on host: {exc}",
            )


app_launcher = AppLauncher()
