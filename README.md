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

## DM4615 Windows SSH agent (draft)

A Windows-local .NET 8 agent is being developed on branch `feat/dm4615-windows-agent`. It is not production-ready and is not installed or deployed.

- Connects to the OLT through SSH on the MGMT network.
- Initial endpoint performs SSH handshake only; no CLI commands or configuration changes.
- Local API is restricted to loopback and protected by an agent token.
- Database schema, migrations, and data are not modified.
- Remote-panel connectivity and read/write CLI operations remain pending validation.

See [docs/architecture.md](docs/architecture.md), [docs/device-cli-validation.md](docs/device-cli-validation.md), and [src/agent/README.md](src/agent/README.md).
