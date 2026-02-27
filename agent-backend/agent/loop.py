# agent-backend/agent/loop.py
# The ReAct agent loop — uses Hugging Face Inference API

from openai import AsyncOpenAI
from agent.tools import execute_tool
from agent.prompt import SYSTEM_PROMPT
import re
import os
from dotenv import load_dotenv

load_dotenv()

# Configure the OpenAI client to point to Hugging Face Inference API
HF_TOKEN = os.getenv("HF_API_TOKEN", "")
HF_MODEL = os.getenv("HF_MODEL", "meta-llama/Llama-3.2-3B-Instruct")

client = AsyncOpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN,
)

# Regex to parse TOOL_CALL: tool_name(arg1="value1", arg2="value2")
TOOL_CALL_PATTERN = re.compile(
    r'TOOL_CALL:\s*(\w+)\((.+?)\)\s*$', re.MULTILINE
)
ARG_PATTERN = re.compile(r'(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*')


def parse_tool_call(text: str):
    """Parse a TOOL_CALL line from the model's response."""
    match = TOOL_CALL_PATTERN.search(text)
    if not match:
        return None, None
    tool_name = match.group(1)
    args_str = match.group(2)
    args = {}
    for arg_match in ARG_PATTERN.finditer(args_str):
        key = arg_match.group(1)
        value = arg_match.group(2).replace('\\"', '"').replace('\\n', '\n')
        args[key] = value
    return tool_name, args


async def run_agent(user_message: str, history: list, workspace_path: str = ""):
    """
    Run the ReAct agent loop with prompt-based tool calling.
    Yields text chunks as the agent thinks and responds.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add history (only user/assistant messages)
    for h in history:
        if h.get("role") in ("user", "assistant"):
            messages.append({"role": h["role"], "content": h.get("content", "")})

    # Include workspace context so the agent knows the project root
    ws_note = ""
    if workspace_path:
        ws_note = f"\n[User's workspace root: {workspace_path}]\n"
    messages.append({"role": "user", "content": ws_note + user_message})

    max_iterations = 10

    for i in range(max_iterations):
        try:
            response = await client.chat.completions.create(
                model=HF_MODEL,
                messages=messages,
                max_tokens=2048,
                stream=False,
            )
        except Exception as e:
            yield f"Error calling LLM: {e}"
            return

        reply = response.choices[0].message.content or ""

        # Check if the response contains a tool call
        tool_name, tool_args = parse_tool_call(reply)

        if tool_name and tool_args is not None:
            before_tool = reply[:reply.find("TOOL_CALL:")].strip()
            if before_tool:
                yield before_tool + "\n"

            yield f"[TOOL] Using tool: {tool_name}\n"

            result = execute_tool(tool_name, tool_args, workspace_path)

            messages.append({"role": "assistant", "content": reply})
            messages.append({
                "role": "user",
                "content": f"[Tool Result for {tool_name}]:\n{result}\n\nNow continue your response using the tool result above."
            })
        else:
            if reply.strip():
                yield reply
            else:
                yield "I couldn't generate a response. Please try again."
            return

    yield "\n⚠️ Agent reached maximum iterations. Stopping."
