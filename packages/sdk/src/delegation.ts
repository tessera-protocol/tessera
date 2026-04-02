import { randomUUID } from 'node:crypto';
import type { AgentDelegation, AgentScope, TesseraCredential } from './types.js';
import { signDelegation } from './crypto.js';

export function createDelegation(
  holderSecretKey: string,
  credential: TesseraCredential,
  params: {
    agentName: string;
    scope: AgentScope;
    expiresAt: number;
    issuedAt?: number;
    parentScope?: AgentScope | null;
  },
): AgentDelegation {
  const delegationWithoutSignature = {
    id: randomUUID(),
    parentCommitment: credential.identityCommitment,
    agentName: params.agentName,
    parentScope: params.parentScope ?? null,
    scope: params.scope,
    issuedAt: params.issuedAt ?? Math.floor(Date.now() / 1000),
    expiresAt: params.expiresAt,
  };

  return {
    ...delegationWithoutSignature,
    parentSignature: signDelegation(delegationWithoutSignature, holderSecretKey),
  };
}
