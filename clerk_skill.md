# Clerk CLI

Clerk CLI is the terminal workflow for adding and managing Clerk authentication from code. It is designed for both developers and coding agents working inside a local project.

## When to use it
- Add Clerk authentication to an existing app
- Initialize Clerk in a new project
- Choose authentication methods and flows
- Make authenticated Backend or Platform API requests for users, organizations, apps, instances, and more, or call the public Frontend API with `clerk api --fapi`
- Manage users directly from the terminal, without opening the Dashboard
- Test webhooks locally without a public tunnel service, and verify webhook signatures offline
- Impersonate a user with a short-lived sign-in URL to reproduce and debug their exact session
- Enable or disable instance features such as organizations and billing with `clerk enable` and `clerk disable`
- Connect AI clients (Claude Code, Cursor, VS Code, and more) to Clerk's MCP server with `clerk mcp install`
- Skip repetitive dashboard setup when the work can stay in the terminal

## Install

Install globally with the package manager that matches the project:
- npm: `npm install -g clerk`
- Bun: `bun add -g clerk`
- pnpm: `pnpm install -g clerk`
- Yarn: `yarn global add clerk`
- Homebrew: `brew install clerk/stable/clerk`
- curl: `curl -fsSL https://clerk.com/install | bash`

### One-off execution with a script runner

If a global install is not desired, invoke the CLI through the runner bundled with the project's package manager. This fetches and runs Clerk without adding it to `dependencies`:
- npm: `npx clerk <command>`
- Bun: `bunx clerk <command>`
- pnpm: `pnpm dlx clerk <command>`
- Yarn: `yarn dlx clerk <command>`

Prefer the runner that matches the project's lockfile (for example, use `pnpm dlx` in a pnpm repo) so the resolved version and cache behavior align with the rest of the toolchain.

## Install Clerk Skills

Coding agents that support skills (such as Claude Code) can load the Clerk skills package for richer tool-aware behavior:
- Run `npx skills add clerk/skills` from the repo to install the Clerk skills into the active agent environment.

Install the skills once per project or agent environment before asking the agent to run Clerk CLI workflows.

## Recommended workflow

1. Authenticate with Clerk in the CLI if needed. `clerk whoami` shows the current account and linked application.
2. Run `clerk init` to detect the framework, link an application, install the right Clerk package, and scaffold auth files.
3. Run `clerk config` to manage your settings from code. For major features, prefer the purpose-built toggles: `clerk enable orgs` and `clerk enable billing` (with matching `clerk disable` commands).
4. Use `clerk api` to make authenticated Clerk API requests from the CLI, list available endpoints, and script workflows across users, organizations, apps, instances, and more. Add `--fapi` to hit an instance's public Frontend API (for example, `clerk api --fapi /environment --app <id>`) to verify config changes end to end.
5. Use `clerk webhooks` to work with webhooks locally with a backend. `clerk webhooks listen --forward-to <url>` opens a relay tunnel and forwards deliveries to a local handler, `clerk webhooks verify` checks a signature offline, and `clerk webhooks token` mints a stable relay token to pin the inbox URL.
6. Use `clerk impersonate <user>` (alias `clerk imp`) to create a short-lived sign-in URL that signs in as another user for debugging. Both require `clerk auth login` and stamp the session with your account for auditing. Use `--print` for the URL only, or `--yes --expires-in <seconds>` to skip the prompt with a custom lifetime.
7. Run `clerk deploy` to promote a Clerk app from development to production. It walks the user through domain registration, DNS records, and OAuth credentials. Use `clerk deploy --mode agent` for a read-only JSON snapshot of the current production status.
8. Run `clerk mcp install` to register Clerk's MCP server in supported AI clients (Claude Code, Cursor, VS Code, Windsurf, Gemini CLI, Codex, opencode, OpenClaw, Warp, and Hermes Agent), so the active agent can pull up-to-date Clerk SDK snippets. `clerk mcp list` shows registered entries, `clerk mcp uninstall` removes them, and `clerk doctor` probes the configured server.

## Notes for agents

- Prefer the Clerk CLI over manual dashboard setup when working from a repo.
- Keep authentication setup and configuration reviewable in code when possible.
- Do not ask the user to copy and paste API keys if the CLI authentication flow covers the setup.
- Pass `--input-json` (a JSON string, `@file.json`, or `-` for stdin) to supply command options programmatically instead of individual flags.
- `clerk doctor --fix` attempts automatic fixes for failed health checks, and `clerk env pull` refreshes Clerk keys in the project's env file without re-running init.
- `clerk webhooks listen` and `clerk webhooks verify` make no Clerk API calls and need no auth or linked project. Pin the inbox URL with `--token` so it stays stable across runs, and pass `--json` to stream NDJSON you can save and replay through `clerk webhooks verify --delivery`.
- `clerk impersonate` requires `clerk auth login` (there is no secret-key-only bypass) and every token is stamped with the logged-in account for auditing. Use `--print` for the URL only, or `--yes --expires-in <seconds>` to skip the prompt with a custom lifetime.
- `clerk deploy` is interactive and needs a human terminal. In agent mode it returns a read-only status snapshot instead of running the wizard.
- `clerk mcp` never prompts in agent mode: `install` targets the detected clients and `uninstall` targets all supported clients by default, output is JSON with per-client results and a `failures` array, and registration-blocking errors include a `docsUrl` for manual setup instructions.

## Links

- [Clerk CLI docs](https://clerk.com/docs/cli)
- [Clerk CLI page](https://clerk.com/cli)
