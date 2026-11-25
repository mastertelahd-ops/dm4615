from __future__ import annotations

import base64
import hashlib
import hmac
import os
import ipaddress
from typing import Annotated

import paramiko
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_VERSION = "0.1.0"
MGMT_HOST = os.getenv("DM4615_MGMT_HOST", "192.168.0.25")
MGMT_PORT = int(os.getenv("DM4615_MGMT_PORT", "22"))
AGENT_TOKEN = os.getenv("DM4615_AGENT_TOKEN", "")
EXPECTED_HOST_KEY = os.getenv("DM4615_SSH_HOST_KEY_SHA256", "")
ALLOWED_ORIGINS = [
    item.strip()
    for item in os.getenv("DM4615_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if item.strip()
]

# Fail closed: the agent must never start with an empty API token or without a
# pinned SSH host key. The key fingerprint is obtained out-of-band from the OLT.
if len(AGENT_TOKEN) < 32:
    raise RuntimeError("Configure DM4615_AGENT_TOKEN with at least 32 random characters.")
if not EXPECTED_HOST_KEY.startswith("SHA256:"):
    raise RuntimeError("Configure DM4615_SSH_HOST_KEY_SHA256 with the verified SHA256 host-key fingerprint.")
ipaddress.ip_address(MGMT_HOST)

app = FastAPI(title="DM4615 Local Agent", version=APP_VERSION, docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def require_token(authorization: Annotated[str | None, Header()] = None) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Autenticação necessária.")
    supplied = authorization[7:]
    if not hmac.compare_digest(supplied, AGENT_TOKEN):
        raise HTTPException(status_code=401, detail="Token inválido.")


class ConnectionTest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256, repr=False)
    host: str = Field(default=MGMT_HOST)


class PinnedHostKeyPolicy(paramiko.MissingHostKeyPolicy):
    def missing_host_key(self, client, hostname, key):
        digest = base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip("=")
        fingerprint = "SHA256:" + digest
        if not hmac.compare_digest(fingerprint, EXPECTED_HOST_KEY):
            raise paramiko.SSHException("A chave SSH apresentada não corresponde à chave fixada.")
        client.get_host_keys().add(hostname, key.get_name(), key)


@app.middleware("http")
async def local_origin_guard(request: Request, call_next):
    # Requests without Origin are allowed for local diagnostics; browser origins
    # are restricted by CORSMiddleware and the exact allowlist above.
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_ORIGINS:
        raise HTTPException(status_code=403, detail="Origem não autorizada.")
    return await call_next(request)


@app.get("/health")
def health():
    return {"ok": True, "service": "dm4615-local-agent", "version": APP_VERSION}


@app.post("/api/v1/connection/test", dependencies=[Depends(require_token)])
def test_connection(payload: ConnectionTest):
    if payload.host != MGMT_HOST:
        raise HTTPException(status_code=400, detail="O agente só pode testar o endereço MGMT configurado.")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(PinnedHostKeyPolicy())
    try:
        client.connect(
            hostname=MGMT_HOST,
            port=MGMT_PORT,
            username=payload.username,
            password=payload.password,
            timeout=5,
            banner_timeout=5,
            auth_timeout=5,
            look_for_keys=False,
            allow_agent=False,
            compress=False,
        )
        transport = client.get_transport()
        if not transport or not transport.is_active():
            raise paramiko.SSHException("Sessão SSH não permaneceu ativa.")
        return {"connected": True, "host": MGMT_HOST, "port": MGMT_PORT, "protocol": "SSH"}
    except paramiko.AuthenticationException:
        raise HTTPException(status_code=401, detail="Autenticação SSH recusada pela OLT.")
    except (paramiko.SSHException, OSError, TimeoutError) as exc:
        # Do not return library internals, credentials, or network details to clients.
        raise HTTPException(status_code=502, detail="Não foi possível estabelecer a conexão SSH. Verifique IP, rede e chave do equipamento.") from exc
    finally:
        client.close()
