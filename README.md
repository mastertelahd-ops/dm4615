# DM4615

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5048035b-5812-5d98-a874-ee5a764cc22d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and these changes sync back into Lovable.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## DM4615 Windows agent (draft)

The .NET 8 Windows agent is developed on branch `feat/dm4615-windows-agent` and reviewed in PR #3. It is not production-ready, installed, or deployed.

- SSH MGMT handshake with strict SHA-256 host-key verification.
- Current local API listens only on 127.0.0.1:17861 and requires an agent token (except the basic health endpoint).
- Windows self-contained portable build and Inno Setup installer definitions are included.
- Remote panel access over VPN is planned but not enabled; no VPN interface listener or public port is opened.
- No OLT CLI commands, configuration changes, database schema, migrations, or data are modified.

Build instructions: [docs/windows-agent-vpn.md](docs/windows-agent-vpn.md).
See also [docs/architecture.md](docs/architecture.md), [docs/device-cli-validation.md](docs/device-cli-validation.md), and [src/agent/README.md](src/agent/README.md).
