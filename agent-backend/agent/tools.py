# agent-backend/agent/tools.py
# Tool definitions and implementations for the agent

import os
import subprocess

# OpenAI-compatible tool definitions
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the full contents of a file at the given path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The absolute or relative file path to read."
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file at the given path. Creates the file if it doesn't exist, overwrites if it does.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The file path to write to."
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to write to the file."
                    }
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_bash",
            "description": "Run a bash command and return the output. Use for listing files, searching, or running scripts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The bash command to execute."
                    }
                },
                "required": ["command"]
            }
        }
    }
]


def execute_tool(name: str, args: dict) -> str:
    """Execute a tool by name with the given arguments."""
    if name == "read_file":
        try:
            path = args["path"]
            if not os.path.exists(path):
                return f"Error: File not found: {path}"
            with open(path, "r") as f:
                content = f.read()
            # Limit output to prevent overwhelming context
            if len(content) > 10000:
                return content[:10000] + "\n\n... [truncated, file is too large]"
            return content
        except Exception as e:
            return f"Error reading file: {e}"

    elif name == "write_file":
        try:
            path = args["path"]
            content = args["content"]
            # Create parent directories if needed
            os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
            with open(path, "w") as f:
                f.write(content)
            return f"Successfully wrote {len(content)} characters to {path}"
        except Exception as e:
            return f"Error writing file: {e}"

    elif name == "run_bash":
        try:
            command = args["command"]
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            output = result.stdout or ""
            if result.stderr:
                output += f"\nSTDERR: {result.stderr}"
            if not output.strip():
                output = "(no output)"
            # Limit output
            if len(output) > 5000:
                output = output[:5000] + "\n\n... [truncated]"
            return output
        except subprocess.TimeoutExpired:
            return "Error: Command timed out after 30 seconds."
        except Exception as e:
            return f"Error running command: {e}"

    return f"Unknown tool: {name}"
