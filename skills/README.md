# Project Skills

This directory is the canonical, agent-independent source for the repository's AI development Skills.

Each Skill is self-contained and exposes its instructions through `SKILL.md`. Optional references, examples, and
agent-specific metadata remain inside the Skill directory but are not required by the Skill contract.

Compatibility paths are available at `.agents/skills`, `.aiassistant/skills`, and `agent/skills` for tools that
discover Skills through a provider-specific location. During local development these paths may be links to this
directory. The repository hooks materialize their contents as physical files before a commit and restore the local
links afterward. Do not edit provider-specific copies directly: add or update Skill content under this directory.
