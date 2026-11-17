# flux-webui

A SPINE//FLUX web UI + adapter for an OpenCode server, built web-first (the APK is a packaging step).

Status: in active development — foundation phases done, UI phases ahead.

## Architecture

```
Web / APK client
      │
      ▼
flux adapter (Node, 127.0.0.1:28572)
      │
      ▼
OpenCode server
      │
      ▼
Model provider
```

Credentials are set at runtime on the device (adapter login and upstream registry) and are never stored in this repository.

> The public repository name `opencode2-android-apk` is descriptive; the product name is **flux-webui**.
