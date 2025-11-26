## ChatGPT MCP Connector Limitations for `generateViduVideo`

This project hosts an XMCP HTTP server intended to expose a `generateViduVideo` tool to ChatGPT via the MCP HTTP connector. The server and tool logic are working correctly when called directly, but there are limitations in the current ChatGPT connector layer that prevent the intended “one‑click video generation from ChatGPT” experience from being reliable.

### Intended flow

- ChatGPT calls the `generateViduVideo` MCP tool on `https://media-gen-mcp-calls.fly.dev/mcp`.
- Tool arguments:
  - `prompt` (or `promptBase64`) – long natural‑language description of the video.
  - `durationSeconds`, `aspectRatio`, `style`.
  - `referenceImageUrl` – frame image URL for image‑to‑video.
- The server:
  - Resolves the prompt (preferring `promptBase64` when present).
  - Cleans it (removing Unicode line/paragraph separators, collapsing whitespace).
  - Calls the Vidu REST API and returns a structured result.

When called directly (e.g. via `curl` or a custom MCP client), this works as designed.

### Connector‑side bugs / limitations

1. **`ByteString` / U+2028 (`8232`) encoding failure**
   - Error seen inside ChatGPT when attempting to call the tool:
     - “Cannot convert argument to a ByteString because the character at index 62 has a value of 8232 which is greater than 255.”
   - 8232 is Unicode **U+2028 LINE SEPARATOR**.
   - This exception is thrown **before** the HTTP request reaches `https://media-gen-mcp-calls.fly.dev/mcp`:
     - The connector serializes the tool `args` to JSON.
     - While converting that JSON string to a `ByteString`, a U+2028 appears somewhere in the serialized text.
     - The conversion fails and the call is never sent to the server.
   - Because this happens entirely inside the connector, server‑side prompt cleaning (which runs *after* the request arrives) cannot fix it.

2. **Base64 field plus strict schema still subject to connector behavior**
   - To mitigate U+2028, the tool schema now includes:
     - `promptBase64` – base64‑encoded prompt text (ASCII‑only), preferred.
     - `prompt` – optional plain text, used only when `promptBase64` is absent.
   - The server:
     - Decodes `promptBase64` using `Buffer.from(promptBase64, "base64").toString("utf8")`.
     - Falls back to `prompt` if `promptBase64` is not provided.
   - Issues seen from inside ChatGPT:
     - A base64 value with a single stray space correctly fails the Zod regex (`^[A-Za-z0-9+/=]+$`), but there is no way for ChatGPT to “see” this ahead of time.
     - Even a syntactically valid base64 string might still pick up U+2028 when the connector wraps/logs JSON, re‑introducing the `ByteString` error.
   - Net effect: **the connector may still reject tool calls before the server sees them**, even though the server’s contract and validation are correct.

### Current status

- ✅ XMCP server reachable at `https://media-gen-mcp-calls.fly.dev/mcp` and stable.
- ✅ `generateViduVideo` tool schema:
  - `prompt?: string`
  - `promptBase64?: string` (preferred)
  - `durationSeconds?: number`
  - `aspectRatio?: string`
  - `style?: string`
  - `referenceImageUrl?: string`
- ✅ Server:
  - Prefers `promptBase64`, decodes it, then sanitizes text.
  - Supports reference image URL for image‑to‑video.
- ❌ From within some ChatGPT MCP sessions, long or complex prompts can still fail at the connector layer with `ByteString` / `8232` errors or base64 validation issues.

### Workaround: call the tool outside ChatGPT

Until the connector issues are fixed, the reliable path is:

1. Use ChatGPT to *compose* the prompt and arguments.
2. Run the actual MCP HTTP call from your own environment (CLI, script, or client) where you control JSON and base64.

Example JSON for a direct call:

```json
{
  "prompt": "8 second 16:9 anime video of happy boy with brown ponytail and glowing pendant, small winged robot cat sitting on his head, both laughing with gentle looping motion, futuristic green eco city background with glass towers and trees, smooth kawaii style joyful mood",
  "durationSeconds": 8,
  "aspectRatio": "16:9",
  "style": "anime kawaii",
  "referenceImageUrl": "https://chatgpt.com/s/m_6926a5e163488191934df308c3438902"
}
```

Or base64 variant:

```json
{
  "promptBase64": "<base64_of_the_prompt_above>",
  "durationSeconds": 8,
  "aspectRatio": "16:9",
  "style": "anime kawaii",
  "referenceImageUrl": "https://chatgpt.com/s/m_6926a5e163488191934df308c3438902"
}
```

These payloads work correctly when sent directly to the XMCP HTTP endpoint.

### Suggested information for an OpenAI / ChatGPT bug report

When reporting this to OpenAI, include:

- The exact error message:  
  “Cannot convert argument to a ByteString because the character at index XX has a value of 8232 which is greater than 255.”
- Clarify that:
  - This occurs when calling an MCP HTTP server at `https://media-gen-mcp-calls.fly.dev/mcp`.
  - The server is never hit; the error is thrown by the ChatGPT MCP connector while serializing tool arguments.
  - The problem persists even when the prompt is ASCII‑only or base64‑encoded and validated by schema.
- Describe the expected behavior:
  - The connector should either:
    - Preserve UTF‑8 text faithfully, or
    - Avoid injecting U+2028 into the JSON `args` string, or
    - Tolerate such characters when converting to a ByteString.
- Steps to reproduce:
  1. Configure a ChatGPT connector pointing at the MCP HTTP server above.
  2. Define a tool with a `prompt` string (or `promptBase64` string) argument.
  3. From a ChatGPT conversation, attempt to call the tool with a long natural‑language prompt.
  4. Observe that the call fails with the `ByteString` / `8232` error before any request reaches the server.


