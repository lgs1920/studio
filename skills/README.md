# Project Skills

This directory is the canonical, agent-independent source for the repository's AI development Skills.

Each Skill is self-contained and exposes its instructions through `SKILL.md`. Optional references, examples, and
agent-specific metadata remain inside the Skill directory but are not required by the Skill contract.

Compatibility links are kept at `.agents/skills`, `.aiassistant/skills`, `agent/skills`, `.claude/skills`, and
`.junie/skills` for tools that discover Skills through a provider-specific location. Do not edit those locations
directly: add or update Skill content under this directory.
