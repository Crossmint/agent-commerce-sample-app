# GOAT skill

Teaches a coding agent (Claude Code, Codex, Cursor, and others that read `SKILL.md`) when and how to use the `goat` CLI.

## Requirements

```sh
npm i -g goat
goat login --api https://wallet.example.com/api/goat
```

## Install the skill

With the skills CLI:

```sh
npx skills add crossmint/goat
```

Or copy the folder by hand:

```sh
# Claude Code, for one user
mkdir -p ~/.claude/skills
cp -r skills/goat ~/.claude/skills/goat

# Claude Code, for one project
mkdir -p .claude/skills
cp -r skills/goat .claude/skills/goat
```

Restart the agent. Ask it to buy something. It will run `goat agent-card request` and show you an approval URL.

## What the skill enforces

- Log in first. Exit code 3 means run `goat login`.
- Request an agent card and show the approval URL to the user verbatim.
- Prefer `goat checkout create` over `goat agent-card reveal`.
- Never paste a revealed card number into chat, logs, or files.
- Read exit codes: 0 ok, 1 error, 2 needs the user, 3 not logged in.
