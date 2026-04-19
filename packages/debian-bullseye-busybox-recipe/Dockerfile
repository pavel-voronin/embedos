FROM --platform=linux/386 i386/debian:bullseye AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    busybox-static \
    ncurses-base \
    ncurses-bin \
    ncurses-term

FROM --platform=linux/386 i386/debian:bullseye AS assembler

RUN rm -rf /var/lib/apt/lists/* \
  && mkdir -p /rootfs/bin /rootfs/usr/bin /rootfs/root /rootfs/tmp /rootfs/proc /rootfs/dev /rootfs/etc /rootfs/lib /rootfs/lib/i386-linux-gnu /rootfs/lib/terminfo/x

COPY --from=builder /bin/bash /rootfs/bin/bash
COPY --from=builder /bin/busybox /rootfs/bin/busybox
COPY --from=builder /lib/ld-linux.so.2 /rootfs/lib/ld-linux.so.2
COPY --from=builder /lib/i386-linux-gnu/libc.so.6 /rootfs/lib/i386-linux-gnu/libc.so.6
COPY --from=builder /lib/i386-linux-gnu/libdl.so.2 /rootfs/lib/i386-linux-gnu/libdl.so.2
COPY --from=builder /lib/i386-linux-gnu/libpthread.so.0 /rootfs/lib/i386-linux-gnu/libpthread.so.0
COPY --from=builder /lib/i386-linux-gnu/libtinfo.so.6 /rootfs/lib/i386-linux-gnu/libtinfo.so.6
COPY --from=builder /lib/terminfo/x/xterm /rootfs/lib/terminfo/x/xterm
COPY --from=builder /lib/terminfo/x/xterm-256color /rootfs/lib/terminfo/x/xterm-256color

RUN ln -sf /bin/busybox /rootfs/bin/sh \
  && ln -sf /bin/busybox /rootfs/bin/ls \
  && ln -sf /bin/busybox /rootfs/bin/cat \
  && ln -sf /bin/busybox /rootfs/bin/echo \
  && ln -sf /bin/busybox /rootfs/bin/cp \
  && ln -sf /bin/busybox /rootfs/bin/chmod \
  && ln -sf /bin/busybox /rootfs/bin/mkdir \
  && ln -sf /bin/busybox /rootfs/bin/rm \
  && ln -sf /bin/busybox /rootfs/bin/uname \
  && ln -sf /bin/busybox /rootfs/bin/tty \
  && ln -sf /bin/busybox /rootfs/bin/clear \
  && ln -sf /bin/busybox /rootfs/bin/env \
  && ln -sf /bin/busybox /rootfs/bin/pwd \
  && ln -sf /bin/busybox /rootfs/bin/grep

RUN printf 'root:x:0:0:root:/root:/bin/bash\n' > /rootfs/etc/passwd \
  && printf 'root:x:0:\n' > /rootfs/etc/group \
  && printf '%s\n' \
    'export PATH=/bin:/usr/bin' \
    'export TERM=xterm-256color' \
    'export XDG_DATA_HOME=/root/.local/share' \
    'stty erase "^?" 2>/dev/null || stty erase "^H" 2>/dev/null || true' \
    'PS1="root@embedos:\\w# "' \
    > /rootfs/root/.bashrc

FROM scratch

COPY --from=assembler /rootfs/ /
