import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Group } from '@semaphore-protocol/group';
import { generateIssuerKeypair } from '@tessera-protocol/sdk';
import { signCredential } from '@tessera-protocol/sdk/dist/crypto.js';
import type { AnchorTier, Jurisdiction, TesseraCredential } from '@tessera-protocol/sdk';

const ROOT_HISTORY_LIMIT = 11;
const CREDENTIAL_LIFETIME_SECONDS = 365 * 24 * 60 * 60;

interface IssuerKeysFile {
  privateKeyPem: string;
  publicKeyPem: string;
}

interface GroupStateFile {
  groupExport: string;
  recentRoots: string[];
  anchorHashes: string[];
}

export interface IssueCredentialInput {
  commitment: string;
  anchorType: string;
  anchorHash: string;
  tier: AnchorTier;
  jurisdiction: Jurisdiction;
  holderPublicKey?: string;
}

export interface IssuedCredentialResponse {
  credential: TesseraCredential & {
    issuedAt: number;
    anchorType: string;
    anchorHash: string;
  };
  groupRoot: string;
}

export interface IssuerServiceStateOptions {
  dataDir: string;
}

export class DuplicateCommitmentError extends Error {}
export class DuplicateAnchorError extends Error {}

export class IssuerServiceState {
  readonly dataDir: string;
  readonly keysPath: string;
  readonly groupPath: string;
  readonly nullifierDbPath: string;
  readonly startedAt: number;

  private readonly issuerKeys: IssuerKeysFile;
  private group: Group;
  private recentRoots: string[];
  private anchorHashes: Set<string>;

  constructor(options: IssuerServiceStateOptions) {
    this.dataDir = options.dataDir;
    this.keysPath = join(this.dataDir, 'issuer-keys.json');
    this.groupPath = join(this.dataDir, 'group.json');
    this.nullifierDbPath = join(this.dataDir, 'nullifiers.db');
    this.startedAt = Date.now();

    mkdirSync(this.dataDir, { recursive: true });
    this.issuerKeys = loadOrCreateIssuerKeys(this.keysPath);

    const groupState = loadGroupState(this.groupPath);
    this.group = groupState.group;
    this.recentRoots = groupState.recentRoots;
    this.anchorHashes = new Set(groupState.anchorHashes);
  }

  getIssuerPublicKey(): string {
    return this.issuerKeys.publicKeyPem;
  }

  getUptimeSeconds(): number {
    return (Date.now() - this.startedAt) / 1000;
  }

  getGroupSize(): number {
    return this.group.size;
  }

  getCurrentRoot(): string {
    return this.group.root.toString();
  }

  getRecentRoots(): string[] {
    return [...this.recentRoots];
  }

  getGroup(): Group {
    return this.group;
  }

  issueCredential(input: IssueCredentialInput): IssuedCredentialResponse {
    if (this.group.indexOf(input.commitment) !== -1) {
      throw new DuplicateCommitmentError('This commitment is already in the issuer group');
    }

    if (this.anchorHashes.has(input.anchorHash)) {
      throw new DuplicateAnchorError('This anchor has already been used to issue a credential');
    }

    this.group.addMember(input.commitment);
    this.anchorHashes.add(input.anchorHash);
    this.recordRoot(this.group.root.toString());
    this.persistGroupState();

    const issuedAt = Math.floor(Date.now() / 1000);
    const credentialBase = {
      identityCommitment: input.commitment,
      holderPublicKey: input.holderPublicKey ?? this.issuerKeys.publicKeyPem,
      issuerPublicKey: this.issuerKeys.publicKeyPem,
      anchor: {
        tier: input.tier,
        jurisdiction: input.jurisdiction,
        verifiedAt: issuedAt,
      },
      expiresAt: issuedAt + CREDENTIAL_LIFETIME_SECONDS,
    };

    const credential: IssuedCredentialResponse['credential'] = {
      ...credentialBase,
      issuedAt,
      anchorType: input.anchorType,
      anchorHash: input.anchorHash,
      issuerSignature: signCredential(credentialBase, this.issuerKeys.privateKeyPem),
    };

    return {
      credential,
      groupRoot: this.group.root.toString(),
    };
  }

  log(message: string, details?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const suffix = details ? ` ${JSON.stringify(details)}` : '';
    console.log(`[${timestamp}] ${message}${suffix}`);
  }

  private recordRoot(root: string): void {
    this.recentRoots.push(root);
    if (this.recentRoots.length > ROOT_HISTORY_LIMIT) {
      this.recentRoots.shift();
    }
  }

  private persistGroupState(): void {
    const state: GroupStateFile = {
      groupExport: this.group.export(),
      recentRoots: this.recentRoots,
      anchorHashes: [...this.anchorHashes],
    };

    writeFileSync(this.groupPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

function loadOrCreateIssuerKeys(keysPath: string): IssuerKeysFile {
  if (existsSync(keysPath)) {
    return JSON.parse(readFileSync(keysPath, 'utf8')) as IssuerKeysFile;
  }

  const keypair = generateIssuerKeypair();
  const keys: IssuerKeysFile = {
    privateKeyPem: keypair.privateKeyPem,
    publicKeyPem: keypair.publicKeyPem,
  };

  writeFileSync(keysPath, `${JSON.stringify(keys, null, 2)}\n`, 'utf8');
  console.log(`[${new Date().toISOString()}] Generated issuer keypair`, {
    publicKeyPem: keypair.publicKeyPem,
  });

  return keys;
}

function loadGroupState(groupPath: string): {
  group: Group;
  recentRoots: string[];
  anchorHashes: string[];
} {
  if (!existsSync(groupPath)) {
    const group = new Group();
    const currentRoot = group.root.toString();
    const initialState: GroupStateFile = {
      groupExport: group.export(),
      recentRoots: [currentRoot],
      anchorHashes: [],
    };

    writeFileSync(groupPath, `${JSON.stringify(initialState, null, 2)}\n`, 'utf8');

    return {
      group,
      recentRoots: initialState.recentRoots,
      anchorHashes: initialState.anchorHashes,
    };
  }

  const parsed = JSON.parse(readFileSync(groupPath, 'utf8')) as GroupStateFile;
  const group = Group.import(parsed.groupExport);
  const currentRoot = group.root.toString();
  const recentRoots = parsed.recentRoots.length > 0 ? parsed.recentRoots : [currentRoot];

  if (!recentRoots.includes(currentRoot)) {
    recentRoots.push(currentRoot);
  }

  return {
    group,
    recentRoots: recentRoots.slice(-ROOT_HISTORY_LIMIT),
    anchorHashes: parsed.anchorHashes ?? [],
  };
}
