import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  KeyObject,
} from 'node:crypto';
import { encodeBytes32String } from 'ethers/abi';
import { toBigInt } from 'ethers/utils';
import type { AgentDelegation, AgentScope, TesseraCredential } from './types.js';

interface CredentialPayload {
  identityCommitment: string;
  holderPublicKey: string;
  issuerPublicKey: string;
  anchor: TesseraCredential['anchor'];
  expiresAt: number;
}

interface DelegationPayload {
  parentCommitment: string;
  agentName: string;
  parentScope: AgentScope | null;
  scope: AgentScope;
  issuedAt: number;
  expiresAt: number;
}

export function generateEd25519KeyPair(): {
  privateKeyPem: string;
  publicKeyPem: string;
} {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');

  return {
    privateKeyPem: exportPrivateKeyPem(privateKey),
    publicKeyPem: exportPublicKeyPem(publicKey),
  };
}

export function signCredential(
  credential: Omit<TesseraCredential, 'issuerSignature'>,
  issuerPrivateKeyPem: string,
): string {
  return signPayload(getCredentialPayload(credential), issuerPrivateKeyPem);
}

export function verifyCredentialSignature(
  credential: TesseraCredential,
  trustedIssuerPublicKeys: string[],
): boolean {
  if (!trustedIssuerPublicKeys.includes(credential.issuerPublicKey)) {
    return false;
  }

  return verifyPayload(
    getCredentialPayload(credential),
    credential.issuerSignature,
    credential.issuerPublicKey,
  );
}

export function signDelegation(
  delegation: Omit<AgentDelegation, 'parentSignature'>,
  holderPrivateKeyPem: string,
): string {
  return signPayload(getDelegationPayload(delegation), holderPrivateKeyPem);
}

export function verifyDelegationSignature(
  delegation: AgentDelegation,
  holderPublicKeyPem: string,
): boolean {
  return verifyPayload(
    getDelegationPayload(delegation),
    delegation.parentSignature,
    holderPublicKeyPem,
  );
}

export function isScopeContained(
  scope: AgentScope,
  parentScope: AgentScope | null | undefined,
): boolean {
  if (!parentScope) {
    return true;
  }

  for (const [key, value] of Object.entries(scope)) {
    const parentValue = parentScope[key];

    if (parentValue === undefined) {
      return false;
    }

    if (Array.isArray(value)) {
      if (!Array.isArray(parentValue)) {
        return false;
      }

      if (!value.every((item) => parentValue.includes(item))) {
        return false;
      }

      continue;
    }

    if (typeof value === 'number') {
      if (typeof parentValue !== 'number' || value > parentValue) {
        return false;
      }

      continue;
    }

    if (typeof value === 'boolean') {
      if (typeof parentValue !== 'boolean' || (value && !parentValue)) {
        return false;
      }

      continue;
    }

    if (value !== parentValue) {
      return false;
    }
  }

  return true;
}

export function exportPublicKeyPem(publicKey: KeyObject): string {
  return publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

export function exportPrivateKeyPem(privateKey: KeyObject): string {
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

export function normalizeSemaphoreScope(scope: string): string {
  return toBigInt(encodeBytes32String(scope)).toString();
}

function signPayload(payload: unknown, privateKeyPem: string): string {
  const signature = sign(
    null,
    Buffer.from(stableStringify(payload)),
    createPrivateKey(privateKeyPem),
  );

  return signature.toString('base64');
}

function verifyPayload(
  payload: unknown,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  return verify(
    null,
    Buffer.from(stableStringify(payload)),
    createPublicKey(publicKeyPem),
    Buffer.from(signatureBase64, 'base64'),
  );
}

function getCredentialPayload(
  credential: Omit<TesseraCredential, 'issuerSignature'>,
): CredentialPayload {
  return {
    identityCommitment: credential.identityCommitment,
    holderPublicKey: credential.holderPublicKey,
    issuerPublicKey: credential.issuerPublicKey,
    anchor: credential.anchor,
    expiresAt: credential.expiresAt,
  };
}

function getDelegationPayload(
  delegation: Omit<AgentDelegation, 'parentSignature'>,
): DelegationPayload {
  return {
    parentCommitment: delegation.parentCommitment,
    agentName: delegation.agentName,
    parentScope: delegation.parentScope ?? null,
    scope: delegation.scope,
    issuedAt: delegation.issuedAt,
    expiresAt: delegation.expiresAt,
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}
