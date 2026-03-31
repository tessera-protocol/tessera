"use client";

export type TesseraCredentialRecord = {
  name: string;
  tier: number;
  jurisdiction: string;
  issuedAt: number;
  expiresAt: number;
  identityCommitment: string;
  issuerSignature: string;
  issuerPublicKey: string;
  holderPublicKey: string;
};

export type TesseraAgentScope = {
  browse: boolean;
  post: boolean;
  transact: boolean;
  messages: boolean;
  maxTransactionValue: number;
  currency: string;
};

export type TesseraAgentRecord = {
  id: string;
  name: string;
  scope: TesseraAgentScope;
  issuedAt: number;
  expiresAt: number;
  status: "active" | "revoked";
  parentCommitment: string;
  parentSignature: string;
  token: string;
  publicKey: string;
  revokedAt?: number;
};

export type TesseraActivityRecord = {
  id: string;
  text: string;
  platform: string;
  timestamp: number;
  type: string;
};

type PersistedGroupRecord = {
  exported: string;
  root: string;
};

type StoredKeypairRecord = {
  privateKey: string;
  publicKey: string;
};

const KEYS = {
  credential: "tessera:credential",
  identitySecret: "tessera:identity-secret",
  agents: "tessera:agents",
  activity: "tessera:activity",
  group: "tessera:group",
  issuer: "tessera:issuer-key",
  holder: "tessera:holder-key",
} as const;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeKey(key: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
}

export function hasCredential() {
  return canUseStorage() && Boolean(window.localStorage.getItem(KEYS.credential));
}

export function getCredential() {
  return readJson<TesseraCredentialRecord | null>(KEYS.credential, null);
}

export function setCredential(value: TesseraCredentialRecord) {
  writeJson(KEYS.credential, value);
}

export function clearCredential() {
  removeKey(KEYS.credential);
}

export function getIdentitySecret() {
  return readJson<string | null>(KEYS.identitySecret, null);
}

export function setIdentitySecret(value: string) {
  writeJson(KEYS.identitySecret, value);
}

export function clearIdentitySecret() {
  removeKey(KEYS.identitySecret);
}

export function getAgents() {
  return readJson<TesseraAgentRecord[]>(KEYS.agents, []);
}

export function setAgents(value: TesseraAgentRecord[]) {
  writeJson(KEYS.agents, value);
}

export function clearAgents() {
  removeKey(KEYS.agents);
}

export function getActivity() {
  return readJson<TesseraActivityRecord[]>(KEYS.activity, []);
}

export function setActivity(value: TesseraActivityRecord[]) {
  writeJson(KEYS.activity, value);
}

export function clearActivity() {
  removeKey(KEYS.activity);
}

export function getGroupData() {
  return readJson<PersistedGroupRecord | null>(KEYS.group, null);
}

export function setGroupData(value: PersistedGroupRecord) {
  writeJson(KEYS.group, value);
}

export function clearGroupData() {
  removeKey(KEYS.group);
}

export function getIssuerKey() {
  return readJson<StoredKeypairRecord | null>(KEYS.issuer, null);
}

export function setIssuerKey(value: StoredKeypairRecord) {
  writeJson(KEYS.issuer, value);
}

export function clearIssuerKey() {
  removeKey(KEYS.issuer);
}

export function getHolderKey() {
  return readJson<StoredKeypairRecord | null>(KEYS.holder, null);
}

export function setHolderKey(value: StoredKeypairRecord) {
  writeJson(KEYS.holder, value);
}

export function clearHolderKey() {
  removeKey(KEYS.holder);
}

export function clearAllTesseraState() {
  clearCredential();
  clearIdentitySecret();
  clearAgents();
  clearActivity();
  clearGroupData();
  clearIssuerKey();
  clearHolderKey();
}
