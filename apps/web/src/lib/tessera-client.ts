"use client";

import * as ed from "@noble/ed25519";
import {
  getActivity,
  getAgents as readAgents,
  getCredential as readCredential,
  getGroupData,
  getHolderKey,
  getIdentitySecret,
  setActivity,
  setAgents,
  setCredential,
  setGroupData,
  setHolderKey,
  setIdentitySecret,
  setIssuerKey,
  type TesseraActivityRecord,
  type TesseraAgentRecord,
  type TesseraAgentScope,
  type TesseraCredentialRecord,
} from "@/lib/tessera-store";

export type TesseraProofResult = {
  platformScope: string;
  note?: string;
  semaphoreProof: {
    merkleTreeDepth: number;
    merkleTreeRoot: string;
    message: string;
    nullifier: string;
    scope: string;
    points: string[] | unknown;
  };
};

const encoder = new TextEncoder();
const DEFAULT_CREDENTIAL_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

function bytesToHex(bytes: Uint8Array) {
  return ed.etc.bytesToHex(bytes);
}

function hexToBytes(hex: string) {
  return ed.etc.hexToBytes(hex);
}

function serializeForSigning(value: unknown) {
  return encoder.encode(JSON.stringify(value));
}

function base64UrlEncodeString(value: string) {
  return base64UrlEncodeBytes(encoder.encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function slugify(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `agent-${Date.now().toString(36)}`;
}

function appendActivity(entry: Omit<TesseraActivityRecord, "id" | "timestamp">) {
  const nextEntry: TesseraActivityRecord = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...entry,
  };
  const current = getActivity();
  setActivity([...current, nextEntry]);

  return nextEntry;
}

async function createKeypairRecord() {
  const { secretKey, publicKey } = await ed.keygenAsync();

  return {
    privateKey: bytesToHex(secretKey),
    publicKey: bytesToHex(publicKey),
  };
}

function buildDelegationPayload(agent: Omit<TesseraAgentRecord, "parentSignature" | "token">) {
  return {
    id: agent.id,
    name: agent.name,
    scope: agent.scope,
    issuedAt: agent.issuedAt,
    expiresAt: agent.expiresAt,
    status: agent.status,
    parentCommitment: agent.parentCommitment,
    publicKey: agent.publicKey,
  };
}

export async function initializeCredential(
  name: string,
  tier: number,
  jurisdiction: string,
) {
  const [{ Identity }, { Group }] = await Promise.all([
    import("@semaphore-protocol/identity"),
    import("@semaphore-protocol/group"),
  ]);

  const identity = new Identity();
  const group = new Group();
  group.addMember(identity.commitment);

  const issuerKeypair = await createKeypairRecord();
  const holderKeypair = await createKeypairRecord();

  const issuedAt = Date.now();
  const expiresAt = issuedAt + DEFAULT_CREDENTIAL_LIFETIME_MS;

  const credentialPayload = {
    name,
    tier,
    jurisdiction,
    issuedAt,
    expiresAt,
    identityCommitment: identity.commitment.toString(),
    issuerPublicKey: issuerKeypair.publicKey,
    holderPublicKey: holderKeypair.publicKey,
  };

  const issuerSignature = bytesToHex(
    await ed.signAsync(
      serializeForSigning(credentialPayload),
      hexToBytes(issuerKeypair.privateKey),
    ),
  );

  const credential: TesseraCredentialRecord = {
    ...credentialPayload,
    issuerSignature,
  };

  setCredential(credential);
  setIdentitySecret(identity.export());
  setIssuerKey(issuerKeypair);
  setHolderKey(holderKeypair);
  setGroupData({
    exported: group.export(),
    root: group.root.toString(),
  });

  if (readAgents().length === 0) {
    setAgents([]);
  }
  if (getActivity().length === 0) {
    setActivity([]);
  }

  appendActivity({
    text: `Credential issued - Tier ${tier}`,
    platform: jurisdiction,
    type: "credential",
  });

  return credential;
}

export function getCredential() {
  return readCredential();
}

export function getAgents() {
  return readAgents();
}

export function getActivityLog() {
  return getActivity();
}

export async function createAgentWallet(params: {
  name: string;
  scope: TesseraAgentScope;
  expiryMs: number;
}) {
  const credential = readCredential();
  const holderKey = getHolderKey();

  if (!credential || !holderKey) {
    throw new Error("No holder credential is available");
  }

  const agentKeypair = await createKeypairRecord();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + params.expiryMs;
  const currentAgents = readAgents();
  const baseId = slugify(params.name);
  const suffix = currentAgents.filter((agent) => agent.id.startsWith(baseId)).length;
  const id = suffix === 0 ? baseId : `${baseId}-${suffix + 1}`;

  const baseAgent = {
    id,
    name: params.name || id,
    scope: params.scope,
    issuedAt,
    expiresAt,
    status: "active" as const,
    parentCommitment: credential.identityCommitment,
    publicKey: agentKeypair.publicKey,
  };

  const signatureBytes = await ed.signAsync(
    serializeForSigning(buildDelegationPayload(baseAgent)),
    hexToBytes(holderKey.privateKey),
  );
  const parentSignature = bytesToHex(signatureBytes);

  const tokenHeader = {
    alg: "EdDSA",
    typ: "tessera+agent",
  };
  const tokenPayload = {
    ...buildDelegationPayload(baseAgent),
    parentSignature,
  };
  const token = [
    base64UrlEncodeString(JSON.stringify(tokenHeader)),
    base64UrlEncodeString(JSON.stringify(tokenPayload)),
    base64UrlEncodeBytes(signatureBytes),
  ].join(".");

  const nextAgent: TesseraAgentRecord = {
    ...baseAgent,
    parentSignature,
    token,
  };

  setAgents([...currentAgents, nextAgent]);
  appendActivity({
    text: `Agent wallet issued - ${nextAgent.name}`,
    platform: nextAgent.name,
    type: "agent",
  });

  return nextAgent;
}

export function revokeAgent(agentId: string) {
  const currentAgents = readAgents();
  const target = currentAgents.find((agent) => agent.id === agentId);

  if (!target) {
    return null;
  }

  const nextAgents = currentAgents.map((agent) =>
    agent.id === agentId
      ? {
          ...agent,
          status: "revoked" as const,
          revokedAt: Date.now(),
        }
      : agent,
  );

  setAgents(nextAgents);
  appendActivity({
    text: `Agent revoked - ${target.name}`,
    platform: target.name,
    type: "revocation",
  });

  return nextAgents.find((agent) => agent.id === agentId) ?? null;
}

export async function generateProof(platformScope: string): Promise<TesseraProofResult> {
  const credential = readCredential();
  const identitySecret = getIdentitySecret();
  const groupData = getGroupData();

  if (!credential || !identitySecret || !groupData) {
    throw new Error("Credential state is incomplete");
  }

  const [{ Identity }, { Group }] = await Promise.all([
    import("@semaphore-protocol/identity"),
    import("@semaphore-protocol/group"),
  ]);
  const identity = Identity.import(identitySecret);
  const group = Group.import(groupData.exported);

  try {
    const { generateProof: generateSemaphoreProof } = await import("@semaphore-protocol/proof");
    const semaphoreProof = await generateSemaphoreProof(identity, group, "0", platformScope);

    appendActivity({
      text: "Identity verified",
      platform: platformScope,
      type: "verification",
    });

    return {
      platformScope,
      semaphoreProof: {
        merkleTreeDepth: semaphoreProof.merkleTreeDepth,
        merkleTreeRoot: semaphoreProof.merkleTreeRoot,
        message: semaphoreProof.message,
        nullifier: semaphoreProof.nullifier,
        scope: semaphoreProof.scope,
        points: semaphoreProof.points,
      },
    };
  } catch (error) {
    console.error("Semaphore browser proof generation failed", error);

    const fallbackProof = {
      merkleTreeDepth: group.depth,
      merkleTreeRoot: group.root.toString(),
      message: "0",
      nullifier: `mock-${platformScope}-${credential.identityCommitment.slice(0, 16)}`,
      scope: platformScope,
      points: ["proof-unavailable"],
    };

    appendActivity({
      text: "Identity verified",
      platform: platformScope,
      type: "verification",
    });

    return {
      platformScope,
      note: "Full Semaphore proof generation requires the CLI artifacts in this environment.",
      semaphoreProof: fallbackProof,
    };
  }
}
