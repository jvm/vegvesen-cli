#!/usr/bin/env python3
"""Run a command with selected real PTY descriptors and report bytes as JSON."""
import argparse
import base64
import errno
import json
import os
import pty
import subprocess
import sys
import termios
import threading

parser = argparse.ArgumentParser()
parser.add_argument("--mode", choices=["full", "stdin-tty", "stdout-tty", "stderr-tty"], required=True)
parser.add_argument("command", nargs=argparse.REMAINDER)
args = parser.parse_args()
command = args.command[1:] if args.command[:1] == ["--"] else args.command
if not command:
    parser.error("command required")

master, slave = pty.openpty()
attributes = termios.tcgetattr(slave)
attributes[3] &= ~(termios.ECHO | termios.ECHONL)
termios.tcsetattr(slave, termios.TCSANOW, attributes)
stdin = slave if args.mode in ("full", "stdin-tty") else subprocess.DEVNULL
stdout = slave if args.mode in ("full", "stdout-tty") else subprocess.PIPE
stderr = slave if args.mode in ("full", "stderr-tty") else subprocess.PIPE
process = subprocess.Popen(command, stdin=stdin, stdout=stdout, stderr=stderr, close_fds=True)
os.close(slave)
pty_bytes = bytearray()

def read_pty():
    while True:
        try:
            chunk = os.read(master, 65536)
            if not chunk:
                break
            pty_bytes.extend(chunk)
        except OSError as error:
            if error.errno == errno.EIO:
                break
            raise

reader = threading.Thread(target=read_pty)
reader.start()
try:
    pipe_stdout, pipe_stderr = process.communicate(timeout=5)
except subprocess.TimeoutExpired:
    process.kill()
    pipe_stdout, pipe_stderr = process.communicate()
    timed_out = True
else:
    timed_out = False
reader.join(timeout=1)
os.close(master)

def encoded(value):
    return base64.b64encode(value or b"").decode("ascii")

print(json.dumps({
    "returncode": process.returncode,
    "timed_out": timed_out,
    "pty": encoded(bytes(pty_bytes)),
    "stdout": encoded(pipe_stdout),
    "stderr": encoded(pipe_stderr),
}))
sys.exit(0)
