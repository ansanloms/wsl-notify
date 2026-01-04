# wsl-notify

A Deno project for sending toast notifications from WSL to Windows.

## Overview

wsl-notify is a tool for displaying Windows toast notifications from a WSL2 environment. It uses a Client-Server architecture via UNIX sockets, allowing applications within WSL to easily send Windows notifications.

## Requirements

- WSL2
- Deno
- Windows 10/11

## Systemd Service Setup

To run the server as a background service using systemd, create a user service file:

### 1. Create service file

Create `~/.config/systemd/user/wsl-notify.service`:

```ini
[Unit]
Description=WSL Notify Service
After=network.target

[Service]
Type=simple
ExecStart=/home/USERNAME/.deno/bin/deno run --allow-net --allow-run --allow-read --allow-write --allow-env https://raw.githubusercontent.com/ansanloms/wsl-notify/refs/tags/0.0.1/server.ts
Restart=always
RestartSec=3
Environment=WSL_NOTIFY_SOCK=/tmp/wsl-notify.sock

[Install]
WantedBy=default.target
```

### 2. Enable and start the service

```bash
# Reload systemd daemon
systemctl --user daemon-reload

# Enable and start the service
systemctl --user enable --now wsl-notify

# Check service status
systemctl --user status wsl-notify

# View logs
journalctl --user -u wsl-notify -f
```
