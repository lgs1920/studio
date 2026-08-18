---
name: safe-email-sending
description: Safely prepare, verify, and send emails without requesting, displaying, or transmitting passwords, API keys, tokens, recovery codes, private keys, or other secrets. Use this skill to draft an email, reply to a message, send an attachment, or automate delivery through an authorized mail connector.
---

# Safe Email Sending

## User intent discipline

Never extrapolate beyond the user's request. If a decision is not explicit, ask the user before acting. User directive: “JE N'EXTRAPOLE JAMAIS LA DEMANDE, JE DEMANDE AU MONSIEUR.”


## Overview

This skill governs email drafting and sending with the minimum necessary data. It protects authentication information, requires a final preview before sending, and falls back to a draft when no authorized mail connector is available.

## Workflow

1. Identify the intent: determine whether the user wants a draft, reply, scheduled message, or immediate send.
2. Collect only what is needed: recipient(s), subject, message, language, tone, attachments, and any deadline.
3. Verify recipients, addresses, attachments, and links. Flag any ambiguity before sending.
4. Check the supplied information and message content for secrets. Mask them, do not repeat them, and request removal or replacement with a safe mechanism.
5. Present a final preview: recipients, subject, content summary, attachments, and intended action.
6. Send only when the user explicitly requested it and an authorized mail tool is available. Otherwise, provide a ready-to-copy draft.
7. After the action, confirm only the useful result: draft created, message sent, failure, or a decision still needed. Never display session identifiers, tokens, or authentication headers.

## Security Rules

- Never request or expose a password, API key, OAuth token, MFA code, recovery code, private key, connection string, or equivalent value.
- Never place a secret in the subject, body, recipients, headers, logs, file names, or examples.
- If the user provides a secret, do not quote it. Briefly advise revoking or replacing it if it was exposed, then continue with a neutral placeholder such as `[sensitive information removed]` when sufficient.
- Use credentials already configured in the mail connector. Do not ask the user to paste them into the conversation or a file.
- Refuse to send a message that appears to exfiltrate secrets, conduct phishing, impersonate someone, or perform clearly abusive activity. Offer a legitimate alternative when possible.
- Do not infer an email address from a name when multiple people are possible. Ask for a targeted confirmation.
- Treat attachments as potentially sensitive data: verify their name and relevance, but do not disclose their contents unless necessary.
- Do not automatically send to a large audience, an external list, or with a sensitive attachment without explicit confirmation of the scope.

## Preview Format

Before sending, use a concise preview such as:

```text
Action: send the email
To: recipient@example.com
Cc/Bcc: none
Subject: Proposed subject
Attachments: none
Summary: one sentence describing the content
```

For a draft request, replace `Action` with `Draft` and do not execute a send.

## Decision Rules

- If the user only asks to “draft”, “prepare”, or “write” an email, create a draft and do not send it.
- If the user explicitly asks to “send” it, present the preview and then send through the available connector.
- If the recipient, content, deadline, or attachment is uncertain, ask a targeted question or leave the missing field in the draft.
- If the user asks to schedule a message, check whether the connector supports scheduling. Otherwise, create a draft and explain that scheduling must be completed in the mail client.
- If the user asks for recurring or bulk sending, request the audience, frequency, and unsubscribe rules before taking action.

## Expected Response

Keep the response brief and reveal only what is necessary. On success, state that the email was sent and mention its recipient and subject. Without a connector, provide the draft without claiming it was sent. On failure, explain the cause without including sensitive technical data.

This skill contains no credentials, secrets, real personal data examples, or sensitive configuration files.
