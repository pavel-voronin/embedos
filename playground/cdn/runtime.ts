import { catalogOverlayFiles } from "../catalog.ts";

export const debianBullseyeBusyboxRuntime = {
  env: [
    "HOME=/root",
    "TERM=xterm-256color",
    "PATH=/usr/local/bin:/usr/bin:/bin",
    "LANG=C.UTF-8",
    "COLORTERM=truecolor",
  ],
  storageKey: "embedos-playground-cdn-runtime",
  process: {
    uid: 0,
    gid: 0,
    cwd: "/root",
  },
  resetOverlayOnStart: true,
  rootfsUrl: "/playground/cdn/vendor/runtime/rootfs/embedos-rootfs.ext2",
  overlayFiles: [
    {
      path: "/bin/fz1",
      source: "/playground/cdn/vendor/runtime/assets/fz1",
      executable: true,
    },
    ...catalogOverlayFiles,
  ],
  run: [
    "printf '[embedos] Run fz1 with: fz1\\n'",
    "printf '[embedos] Or press Ctrl+X g to open fz1 and insert the selected command\\n\\n'",
    "fz1 integration bash > /etc/fz1.bash",
    "if ! grep -q 'source /etc/fz1.bash' /root/.bashrc; then",
    "  cat <<'EOF' >> /root/.bashrc",
    "source /etc/fz1.bash",
    "EOF",
    "fi",
    "printf '[embedos] Overlay catalog mounted at /root/.local/share/fz1/catalog\\n'",
    "exec /bin/bash --rcfile /root/.bashrc -i",
  ],
  shell: ["/bin/sh", "-lc"],
};
