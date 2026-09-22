# Agent Commerce skill

Teaches a coding agent (Claude Code, Codex, Cursor, and others that read `SKILL.md`) when and how to use the `agent-commerce` CLI.

## Requirements

```sh
npm i -g @agent-commerce/cli
agent-commerce login --api https://wallet.example.com/api/agent-commerce
```

## Install the skill

With the skills CLI:

```sh
npx skills add crossmint/agent-commerce-sample-app
```

Or copy the folder by hand:

```sh
# Claude Code, for one user
mkdir -p ~/.claude/skills
cp -r skills/agent-commerce ~/.claude/skills/agent-commerce

# Claude Code, for one project
mkdir -p .claude/skills
cp -r skills/agent-commerce .claude/skills/agent-commerce
```

Restart the agent. Ask it to buy something. It will run `agent-commerce agent-card request` and show you an approval URL.

## What the skill enforces

- Log in first. Exit code 3 means run `agent-commerce login`.
- Request an agent card and show the approval URL to the user verbatim.
- Prefer `agent-commerce checkout create` over `agent-commerce agent-card reveal`.
- Never paste a revealed card number into chat, logs, or files.
- Read exit codes: 0 ok, 1 error, 2 needs the user, 3 not logged in.
