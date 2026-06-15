---
name: Dockerode optional deps stubbing in esbuild
description: Dockerode always tries to require ssh2 and @grpc/grpc-js even when using socket/npipe connections. These native deps aren't available in Replit; must be stubbed in esbuild build.mjs.
---

## The Rule

Dockerode loads optional dependencies (`ssh2` via docker-modem/lib/ssh.js, `@grpc/grpc-js` via dockerode/lib/session.js) at module load time, even when only using Unix socket or Windows npipe connections. In Replit's sandbox, these native modules fail to load ("Cannot find module 'ssh2'").

**Why:** pnpm ignores build scripts for ssh2/cpu-features/protobufjs by default in Replit. Even if installed, they may not have built native binaries. The modules are in the `external` list by default so esbuild doesn't bundle them — but then they fail at runtime.

**How to apply:** In `artifacts/api-server/build.mjs`, add an esbuild plugin BEFORE the pino plugin that intercepts these module names and returns an empty CJS stub:

```javascript
{
  name: "dockerode-optional-stubs",
  setup(build) {
    const stubFilter = /^(ssh2|@grpc\/grpc-js|@grpc\/proto-loader)$/;
    build.onResolve({ filter: stubFilter }, (args) => ({
      path: args.path,
      namespace: "dockerode-stub-ns",
    }));
    build.onLoad({ filter: /.*/, namespace: "dockerode-stub-ns" }, () => ({
      contents: "module.exports = {};",
      loader: "js",
    }));
  },
},
```

Also remove `ssh2` from the `external` array so esbuild actually processes the resolve (if it's external, esbuild skips the onResolve hook).

**IMPORTANT:** JavaScript object cannot have duplicate keys. `build.mjs` had `plugins` defined TWICE (once with stubs + pino, once with just pino). The second overwrote the first. Always use a single `plugins` array.
