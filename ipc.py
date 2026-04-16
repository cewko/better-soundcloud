#!/usr/bin/env python3

import sys
import json
import struct
import os
import socket
import tempfile


def get_ipc_path() -> str:
    for env in ("XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"):
        if path := os.environ.get(env):
            return os.path.join(path, "discord-ipc-0")
    return os.path.join(tempfile.gettempdir(), "discord-ipc-0")


def encode_ipc(op: int, payload: dict) -> bytes:
    data = json.dumps(payload).encode()
    return struct.pack("<II", op, len(data)) + data


def decode_ipc(sock: socket.socket) -> tuple[int, dict]:
    def recv_exact(n: int) -> bytes:
        buf = b""
        while len(buf) < n:
            chunk = sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("Discord IPC closed")
            buf += chunk
        return buf

    op, length = struct.unpack("<II", recv_exact(8))
    return op, json.loads(recv_exact(length))


class DiscordIPC:
    def __init__(self, client_id: str):
        self.client_id = client_id
        self._sock: socket.socket | None = None
        self._nonce = 0

    def connect(self) -> None:
        self._sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self._sock.connect(get_ipc_path())
        self._send(0, {"v": 1, "client_id": self.client_id})
        _, data = self._recv()
        if data.get("evt") != "READY":
            raise RuntimeError(f"handshake failed: {data}")

    def set_activity(self, activity: dict) -> None:
        self._nonce += 1
        self._send(1, {
            "cmd": "SET_ACTIVITY",
            "args": {"pid": os.getpid(), "activity": activity},
            "nonce": str(self._nonce),
        })
        self._recv()

    def clear_activity(self) -> None:
        self._nonce += 1
        self._send(1, {
            "cmd": "SET_ACTIVITY",
            "args": {"pid": os.getpid(), "activity": None},
            "nonce": str(self._nonce),
        })
        self._recv()

    def disconnect(self) -> None:
        try:
            if self._sock:
                self._sock.close()
        except Exception:
            pass
        self._sock = None

    def _send(self, op: int, payload: dict) -> None:
        self._sock.sendall(encode_ipc(op, payload))

    def _recv(self) -> tuple[int, dict]:
        return decode_ipc(self._sock)


def read_message() -> dict | None:
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    length = struct.unpack("<I", raw)[0]
    return json.loads(sys.stdin.buffer.read(length))


def write_message(msg: dict) -> None:
    data = json.dumps(msg).encode()
    sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
    sys.stdout.buffer.flush()


def main() -> None:
    ipc: DiscordIPC | None = None

    while msg := read_message():
        client_id = msg.get("clientID")
        msg_type = msg.get("type")

        try:
            if msg_type == "SET_ACTIVITY":
                if ipc is None or ipc.client_id != client_id:
                    if ipc:
                        ipc.disconnect()
                    ipc = DiscordIPC(client_id)
                    ipc.connect()
                    write_message({"status": "connected"})
                ipc.set_activity(msg["activity"])

            elif msg_type == "CLEAR_ACTIVITY" and ipc:
                ipc.clear_activity()

        except Exception as e:
            try:
                if ipc:
                    ipc.disconnect()
                ipc = DiscordIPC(client_id)
                ipc.connect()
                if msg_type == "SET_ACTIVITY":
                    ipc.set_activity(msg["activity"])
            except Exception:
                write_message({"status": "error", "error": str(e)})
                ipc = None

    if ipc:
        ipc.disconnect()


if __name__ == "__main__":
    main()