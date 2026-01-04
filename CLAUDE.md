# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

WSL から Windows にトースト通知を送るための Deno プロジェクト。UNIX ソケットを介した Client-Server アーキテクチャで実装されている。

## アーキテクチャ

### 主要コンポーネント

- **server.ts**: UNIX ソケットサーバーを起動し、受信したリクエストを Windows 通知に変換する
- **socket.ts**: UNIX ソケット通信の共通実装（サーバー起動とコネクション処理）
- **notifier.ts**: Windows PowerShell を使ってトースト通知を送る機能と型定義

### 通信フロー

1. クライアントが UNIX ソケット（デフォルト: `/tmp/wsl-notify.sock`）に `NotifyRequest` を JSON で送信
2. サーバーがリクエストを受信し、`sendWindowsNotification()` で Windows PowerShell を呼び出す
3. PowerShell が Windows Toast Notification API を使って通知を表示
4. サーバーが `NotifyResponse` をクライアントに返す

### 環境変数

- `WSL_NOTIFY_SOCK`: UNIX ソケットのパス（デフォルト: `/tmp/wsl-notify.sock`）

## 開発コマンド

### サーバーの起動

```bash
deno run --allow-net --allow-run --allow-read --allow-write --allow-env ./server.ts
```

### コードフォーマット

```bash
deno fmt
```

### 型チェック

```bash
deno check
```

## 重要な実装上の注意点

- **WSL 環境が必須**: PowerShell を `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe` から実行する前提
- **アイコンパス**: `NotifyRequest.icon` は Windows パス形式である必要がある（例: `C:\path\to\icon.png`）
- **ソケットファイル**: サーバー起動時に既存のソケットファイルを削除するため、`--allow-read --allow-write` 権限が必要
- **バッファサイズ**: ソケット通信のバッファは固定サイズ（サーバー: 4096 バイト、クライアント: 1024 バイト）
