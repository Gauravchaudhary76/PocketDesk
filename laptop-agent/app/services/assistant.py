import re
import io
import uuid
import base64
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from PIL import Image
import mss

from app.config import settings
from app.services.app_launcher import app_launcher
from app.services.file_manager import file_manager
from app.services.system_info import SystemInfoService
from app.services.stream import StreamManager
from app.services.security import SecurityAuditLogger
from app.models.assistant import (
    InterpretedCommandResponse,
    ExecuteCommandResponse,
    IntentCatalogItem,
    IntentCatalogResponse,
)

logger = logging.getLogger("pocketdesk.assistant")

# Prohibited destructive actions and arbitrary shell execution patterns
PROHIBITED_PATTERNS = [
    r"\brm\b", r"\bdel\b", r"\bformat\b", r"\bshutdown\b", r"\breboot\b", r"\brestart\b",
    r"\bkill\b", r"\bpkill\b", r"\btaskkill\b", r"\bdrop\b", r"\bcurl\b", r"\bwget\b",
    r"\bcmd\b", r"\bpowershell\b", r"\beval\b", r"\bexec\b", r"\bbash\b", r"\bsh\b",
    r"\breg\b", r"\bnet user\b", r"\bvssadmin\b", r"\btruncate\b"
]

APP_ALIASES = {
    "notepad": "notepad",
    "text editor": "notepad",
    "notes": "notepad",
    "calc": "calc",
    "calculator": "calc",
    "math": "calc",
    "paint": "mspaint",
    "mspaint": "mspaint",
    "drawing": "mspaint",
    "draw": "mspaint",
    "explorer": "explorer",
    "file explorer": "explorer",
    "my files": "explorer",
    "files": "explorer",
    "edge": "edge",
    "browser": "edge",
    "web browser": "edge",
    "microsoft edge": "edge",
    "code": "code",
    "vs code": "code",
    "vscode": "code",
    "visual studio code": "code",
    "task manager": "taskmgr",
    "taskmgr": "taskmgr",
    "tasks": "taskmgr",
    "terminal": "terminal",
    "powershell": "terminal",
    "command line": "terminal",
    "console": "terminal",
}


class AssistantService:
    """
    Local rule-based AI desktop command interface.
    Maps natural language prompts to a safe, allowlisted set of desktop actions.
    Enforces authorization, confirmation gates, and security audit logging.
    """

    def get_intent_catalog(self) -> IntentCatalogResponse:
        """Return catalog of supported command intents and sample phrases."""
        catalog = [
            IntentCatalogItem(
                intent="open_app",
                action_type="launch_app",
                description="Launch an allowlisted Windows application by name",
                example_phrases=["open notepad", "launch calculator", "start paint", "run task manager"],
                requires_confirmation=False,
            ),
            IntentCatalogItem(
                intent="system_status",
                action_type="get_system_status",
                description="Query host hardware telemetry (OS, CPU, RAM, battery)",
                example_phrases=["how is my laptop doing?", "show system status", "check cpu and battery"],
                requires_confirmation=False,
            ),
            IntentCatalogItem(
                intent="search_files",
                action_type="search_files",
                description="Search for files in approved directories (Downloads, Documents, Desktop)",
                example_phrases=["search for resume.pdf", "find file notes in documents", "look for photos"],
                requires_confirmation=False,
            ),
            IntentCatalogItem(
                intent="screen_stream",
                action_type="control_stream",
                description="Start or stop an authorized desktop screen-sharing session",
                example_phrases=["start screen sharing", "stop screen sharing", "end stream"],
                requires_confirmation=False,
            ),
            IntentCatalogItem(
                intent="screenshot",
                action_type="capture_screenshot",
                description="Capture a live desktop screenshot with explicit user confirmation",
                example_phrases=["take a screenshot", "capture my screen", "snapshot desktop"],
                requires_confirmation=True,
            ),
            IntentCatalogItem(
                intent="help",
                action_type="show_help",
                description="Display help and supported natural-language desktop commands",
                example_phrases=["help", "what can you do?", "list supported commands"],
                requires_confirmation=False,
            ),
        ]
        return IntentCatalogResponse(intents=catalog)

    def parse_command(self, raw_prompt: str) -> InterpretedCommandResponse:
        """
        Parse and interpret user natural language instruction.
        Returns proposed action, validated parameters, and confirmation flags.
        """
        prompt = raw_prompt.strip().lower()
        command_id = f"cmd_{uuid.uuid4().hex[:12]}"

        # 1. Check for prohibited/destructive commands or raw shell injection
        for pat in PROHIBITED_PATTERNS:
            if re.search(pat, prompt):
                logger.warning("Assistant rejected prohibited command pattern '%s' in prompt: '%s'", pat, raw_prompt)
                return InterpretedCommandResponse(
                    command_id=command_id,
                    raw_prompt=raw_prompt,
                    intent="prohibited",
                    action_type="none",
                    parameters={},
                    summary="Blocked: Prohibited command pattern detected.",
                    requires_confirmation=False,
                    is_supported=False,
                    risk_level="prohibited",
                    rejection_reason="Destructive actions and arbitrary shell commands are strictly prohibited by PocketDesk security policy.",
                )

        # 2. Check: Help / Capabilities
        if any(kw in prompt for kw in ["help", "what can you do", "commands", "supported", "guide", "assist"]):
            return InterpretedCommandResponse(
                command_id=command_id,
                raw_prompt=raw_prompt,
                intent="help",
                action_type="show_help",
                parameters={},
                summary="Display catalog of supported AI desktop commands and examples.",
                requires_confirmation=False,
                is_supported=True,
                risk_level="safe",
            )

        # 3. Check: System Status / Telemetry
        if any(kw in prompt for kw in [
            "system status", "telemetry", "how is my laptop", "cpu usage",
            "ram usage", "battery", "hardware status", "health", "system stats", "pc status"
        ]) or (prompt in ["status", "system", "specs"]):
            return InterpretedCommandResponse(
                command_id=command_id,
                raw_prompt=raw_prompt,
                intent="system_status",
                action_type="get_system_status",
                parameters={},
                summary="Query host hardware telemetry (OS, CPU, RAM allocation, and battery status).",
                requires_confirmation=False,
                is_supported=True,
                risk_level="safe",
            )

        # 4. Check: Screen Sharing / Stream Control
        if any(kw in prompt for kw in ["stop screen", "stop stream", "end stream", "stop sharing", "close stream"]):
            return InterpretedCommandResponse(
                command_id=command_id,
                raw_prompt=raw_prompt,
                intent="screen_stream",
                action_type="control_stream",
                parameters={"action": "stop"},
                summary="Terminate active desktop screen streaming session.",
                requires_confirmation=False,
                is_supported=True,
                risk_level="safe",
            )

        if any(kw in prompt for kw in ["start screen", "start stream", "share screen", "begin stream", "screen sharing", "stream desktop"]):
            return InterpretedCommandResponse(
                command_id=command_id,
                raw_prompt=raw_prompt,
                intent="screen_stream",
                action_type="control_stream",
                parameters={"action": "start"},
                summary="Initiate desktop screen streaming session.",
                requires_confirmation=False,
                is_supported=True,
                risk_level="safe",
            )

        # 5. Check: Capture Screenshot (Requires explicit confirmation)
        if any(kw in prompt for kw in ["screenshot", "snapshot", "capture screen", "screen grab", "grab screen"]):
            return InterpretedCommandResponse(
                command_id=command_id,
                raw_prompt=raw_prompt,
                intent="screenshot",
                action_type="capture_screenshot",
                parameters={},
                summary="Capture a live visual screenshot of your Windows desktop.",
                requires_confirmation=True,
                is_supported=True,
                risk_level="moderate",
            )

        # 6. Check: Search Files in Approved Roots
        search_match = re.search(r"(?:find|search|look for|locate)\s+(?:file\s+|document\s+)?([a-zA-Z0-9_\-\.\s]+)", prompt)
        if search_match and not any(prompt.startswith(p) for p in ["open", "launch", "start", "run"]):
            query_raw = search_match.group(1).strip()
            # Check if root is specified
            target_root: Optional[str] = None
            for root_candidate in ["downloads", "documents", "desktop", "pictures"]:
                if f"in {root_candidate}" in prompt:
                    target_root = root_candidate
                    query_raw = query_raw.replace(f"in {root_candidate}", "").strip()

            clean_query = re.sub(r"^(for|file|document)\s+", "", query_raw).strip()
            if clean_query:
                root_label = f" in '{target_root}'" if target_root else " across approved folders"
                return InterpretedCommandResponse(
                    command_id=command_id,
                    raw_prompt=raw_prompt,
                    intent="search_files",
                    action_type="search_files",
                    parameters={"query": clean_query, "root_id": target_root},
                    summary=f"Search for files matching '{clean_query}'{root_label}.",
                    requires_confirmation=False,
                    is_supported=True,
                    risk_level="safe",
                )

        # 7. Check: Launch Allowlisted Application
        app_match = re.search(r"(?:open|launch|start|run)\s+([a-zA-Z0-9_\-\s]+)", prompt)
        if app_match:
            candidate_target = app_match.group(1).strip()
            # Match against known aliases
            matched_app_id = APP_ALIASES.get(candidate_target)
            if not matched_app_id:
                # Check direct or partial match in allowlist
                for alias, aid in APP_ALIASES.items():
                    if alias in candidate_target:
                        matched_app_id = aid
                        break

            if matched_app_id:
                app_info = app_launcher._allowlist.get(matched_app_id)
                if app_info:
                    is_disruptive = app_info.get("is_disruptive", False)
                    return InterpretedCommandResponse(
                        command_id=command_id,
                        raw_prompt=raw_prompt,
                        intent="open_app",
                        action_type="launch_app",
                        parameters={"app_id": matched_app_id},
                        summary=f"Launch approved application: {app_info['name']}.",
                        requires_confirmation=is_disruptive,
                        is_supported=True,
                        risk_level="disruptive" if is_disruptive else "safe",
                    )
            else:
                return InterpretedCommandResponse(
                    command_id=command_id,
                    raw_prompt=raw_prompt,
                    intent="open_app",
                    action_type="launch_app",
                    parameters={},
                    summary=f"Unknown application '{candidate_target}'.",
                    requires_confirmation=False,
                    is_supported=False,
                    risk_level="safe",
                    rejection_reason=f"Application '{candidate_target}' is not in the approved desktop allowlist.",
                )

        # 8. Unrecognized / Ambiguous
        return InterpretedCommandResponse(
            command_id=command_id,
            raw_prompt=raw_prompt,
            intent="unknown",
            action_type="none",
            parameters={},
            summary="Instruction could not be mapped to an authorized action.",
            requires_confirmation=False,
            is_supported=False,
            risk_level="safe",
            rejection_reason="Unrecognized command. Type 'help' to see list of supported desktop instructions.",
        )

    async def execute_command(
        self,
        command_id: str,
        action_type: str,
        parameters: Dict[str, Any],
        confirmed: bool,
        client_ip: str = "unknown",
        device_id: Optional[str] = None,
    ) -> ExecuteCommandResponse:
        """
        Execute an approved desktop action after validating authorization and confirmation gates.
        """
        audit_id = f"audit_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Enforce Confirmation Gate for actions that require user consent
        if action_type == "capture_screenshot" and not confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirmation required: Desktop screenshot capture requires explicit authorization.",
            )

        if action_type == "launch_app":
            app_id = parameters.get("app_id")
            if not app_id or app_id not in app_launcher._allowlist:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid or missing allowlisted app_id '{app_id}'.",
                )
            app_info = app_launcher._allowlist[app_id]
            if app_info.get("is_disruptive") and not confirmed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Confirmation required: Launching '{app_info['name']}' requires explicit confirmation.",
                )

            # Spawn application
            result = app_launcher.launch_app(app_id, confirmed)
            SecurityAuditLogger.log_event(
                event_type="ASSISTANT_LAUNCH_APP",
                client_ip=client_ip,
                device_id=device_id,
                success=True,
                details={"app_id": app_id, "pid": result.pid, "command_id": command_id},
            )
            return ExecuteCommandResponse(
                success=True,
                action_type=action_type,
                message=f"Application '{app_info['name']}' launched successfully.",
                result_data={"app_id": app_id, "pid": result.pid},
                audit_id=audit_id,
                timestamp=now_iso,
            )

        elif action_type == "get_system_status":
            telemetry = SystemInfoService.get_system_info()
            SecurityAuditLogger.log_event(
                event_type="ASSISTANT_GET_SYSTEM_STATUS",
                client_ip=client_ip,
                device_id=device_id,
                success=True,
                details={"command_id": command_id},
            )
            return ExecuteCommandResponse(
                success=True,
                action_type=action_type,
                message="System status retrieved successfully.",
                result_data=telemetry.model_dump(),
                audit_id=audit_id,
                timestamp=now_iso,
            )

        elif action_type == "search_files":
            query = parameters.get("query", "").strip().lower()
            target_root_id = parameters.get("root_id")
            matches = self._search_approved_files(query, target_root_id)

            SecurityAuditLogger.log_event(
                event_type="ASSISTANT_SEARCH_FILES",
                client_ip=client_ip,
                device_id=device_id,
                success=True,
                details={"query": query, "root_id": target_root_id, "matches_found": len(matches)},
            )
            return ExecuteCommandResponse(
                success=True,
                action_type=action_type,
                message=f"Found {len(matches)} matching file(s).",
                result_data={"matches": matches, "query": query},
                audit_id=audit_id,
                timestamp=now_iso,
            )

        elif action_type == "control_stream":
            sub_action = parameters.get("action", "start")
            if sub_action == "stop":
                await StreamManager.stop_stream()
                msg = "Desktop screen streaming session stopped."
            else:
                msg = "Screen streaming is ready. Use the Screen tab to negotiate WebRTC video playback."

            SecurityAuditLogger.log_event(
                event_type="ASSISTANT_CONTROL_STREAM",
                client_ip=client_ip,
                device_id=device_id,
                success=True,
                details={"action": sub_action, "command_id": command_id},
            )
            return ExecuteCommandResponse(
                success=True,
                action_type=action_type,
                message=msg,
                result_data={"action": sub_action},
                audit_id=audit_id,
                timestamp=now_iso,
            )

        elif action_type == "capture_screenshot":
            # Explicitly authorized desktop snapshot
            screenshot_data = self._capture_desktop_screenshot()
            SecurityAuditLogger.log_event(
                event_type="ASSISTANT_CAPTURE_SCREENSHOT",
                client_ip=client_ip,
                device_id=device_id,
                success=True,
                details={"command_id": command_id, "width": screenshot_data["width"], "height": screenshot_data["height"]},
            )
            return ExecuteCommandResponse(
                success=True,
                action_type=action_type,
                message="Desktop screenshot captured successfully.",
                result_data=screenshot_data,
                audit_id=audit_id,
                timestamp=now_iso,
            )

        elif action_type == "show_help":
            catalog = self.get_intent_catalog()
            return ExecuteCommandResponse(
                success=True,
                action_type=action_type,
                message="PocketDesk Assistant supports the following natural-language desktop actions:",
                result_data={"catalog": [i.model_dump() for i in catalog.intents]},
                audit_id=audit_id,
                timestamp=now_iso,
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported action_type '{action_type}'.",
            )

    def _search_approved_files(self, query: str, target_root_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search approved filesystem roots for filenames matching query string."""
        approved = settings.get_approved_roots()
        roots_to_search = (
            {target_root_id: approved[target_root_id]}
            if target_root_id and target_root_id in approved
            else approved
        )

        matches: List[Dict[str, Any]] = []
        max_matches = 25

        for root_id, info in roots_to_search.items():
            base_dir = Path(info["path"]).resolve()
            if not base_dir.exists() or not base_dir.is_dir():
                continue

            try:
                # Walk approved directory (max depth 3 to prevent excessive traversal)
                for root, dirs, files in os.walk(base_dir):
                    rel_to_base = Path(root).relative_to(base_dir)
                    if len(rel_to_base.parts) > 3:
                        dirs.clear()  # Don't descend deeper
                        continue

                    # Filter out sensitive directories
                    dirs[:] = [
                        d for d in dirs
                        if not any(d.lower().startswith(pat) for pat in settings.SENSITIVE_PATTERNS)
                        and not d.startswith(".")
                    ]

                    for filename in files:
                        lowered = filename.lower()
                        # Skip sensitive or blacklisted files
                        if any(lowered.startswith(pat) for pat in settings.SENSITIVE_PATTERNS):
                            continue
                        if Path(filename).suffix.lower() in settings.SENSITIVE_EXTENSIONS:
                            continue

                        if query in lowered:
                            file_path = Path(root) / filename
                            try:
                                rel_path = str(file_path.relative_to(base_dir)).replace("\\", "/")
                                matches.append({
                                    "root_id": root_id,
                                    "root_name": info["name"],
                                    "name": filename,
                                    "relative_path": rel_path,
                                    "size_bytes": file_path.stat().st_size,
                                })
                            except Exception:
                                continue

                            if len(matches) >= max_matches:
                                return matches
            except Exception as exc:
                logger.debug("Error searching root '%s': %s", root_id, exc)

        return matches

    def _capture_desktop_screenshot(self) -> Dict[str, Any]:
        """Capture current Windows desktop frame and return as base64 PNG data URI."""
        with mss.mss() as sct:
            primary = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
            raw = sct.grab(primary)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")

            # Scale to safe preview dimensions (max width 1280)
            orig_w, orig_h = img.size
            if orig_w > 1280:
                scale = 1280 / orig_w
                img = img.resize((1280, int(orig_h * scale)), Image.Resampling.BILINEAR)

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            b64_data = base64.b64encode(buf.getvalue()).decode("utf-8")
            data_uri = f"data:image/jpeg;base64,{b64_data}"

            return {
                "image_data_uri": data_uri,
                "width": img.width,
                "height": img.height,
                "original_width": orig_w,
                "original_height": orig_h,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }


assistant_service = AssistantService()
