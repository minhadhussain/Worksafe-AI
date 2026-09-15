from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect


class AdminEventHub:
    def __init__(self) -> None:
        self._connections: dict[WebSocket, asyncio.Lock] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, initial: dict | None = None) -> None:
        await websocket.accept()
        send_lock = asyncio.Lock()
        async with self._lock:
            async with send_lock:
                if initial is not None:
                    await websocket.send_json(initial)
                self._connections[websocket] = send_lock

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.pop(websocket, None)

    async def broadcast(self, event: dict[str, Any]) -> None:
        async with self._lock:
            connections = tuple(self._connections.items())

        async def send(websocket: WebSocket, send_lock: asyncio.Lock) -> None:
            try:
                async with asyncio.timeout(1):
                    async with send_lock:
                        await websocket.send_json(event)
            except (TimeoutError, OSError, RuntimeError, WebSocketDisconnect):
                await self.disconnect(websocket)
                try:
                    await asyncio.wait_for(websocket.close(code=1013), timeout=0.1)
                except (TimeoutError, OSError, RuntimeError, WebSocketDisconnect):
                    pass
        await asyncio.gather(*(send(websocket, lock) for websocket, lock in connections))
