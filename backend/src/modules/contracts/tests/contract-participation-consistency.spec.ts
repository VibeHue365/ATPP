import { Types } from 'mongoose';
import { ContractPolicyService } from '../contract-policy.service';
import { ContractScope } from '../../bookings/schemas/digital-contract.schema';
import { ProviderAcceptanceStatus } from '../schemas/provider-contract-acceptance.schema';
import { hashContract } from '../canonical-contract';

describe('ContractPolicyService participation consistency', () => {
  const providerId = new Types.ObjectId();
  const ownerUserId = new Types.ObjectId();
  const policies = {
    policyVersion: 1,
    providerDamageCompensation: { method: 'INCIDENT_NEGOTIATION' },
  };
  const mechanism = {
    version: 'mechanism-v2',
    hash: 'a'.repeat(64),
  };
  const template = { version: 'template-v2' };

  const createService = (acceptanceOverrides: Record<string, unknown> = {}) => {
    const acceptance = {
      _id: new Types.ObjectId(),
      providerId,
      acceptedByUserId: ownerUserId,
      scope: ContractScope.AoDaiRental,
      status: ProviderAcceptanceStatus.Active,
      acceptedAt: new Date(Date.now() - 1_000),
      revokedAt: null,
      mechanismVersion: mechanism.version,
      mechanismHash: mechanism.hash,
      templateVersion: template.version,
      policyFingerprint: hashContract(policies),
      ...acceptanceOverrides,
    };
    const query = {
      session: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([acceptance]),
    };
    const acceptanceModel = {
      find: jest.fn().mockReturnValue(query),
    };
    const connection = {
      db: {
        collection: jest.fn((name: string) => {
          if (name !== 'providers') throw new Error(`Unexpected collection ${name}`);
          return {
            findOne: jest.fn().mockResolvedValue({
              _id: providerId,
              userId: ownerUserId,
              status: 'ACTIVE',
              capabilities: ['AODAI_RENTAL'],
            }),
          };
        }),
      },
    };

    return new ContractPolicyService(
      connection as any,
      acceptanceModel as any,
      { currentPoliciesForProvider: jest.fn().mockResolvedValue(policies) } as any,
      { getApproved: jest.fn().mockReturnValue(mechanism) } as any,
      { getApproved: jest.fn().mockReturnValue(template) } as any,
    );
  };

  it('keeps a fully valid acceptance active', async () => {
    await expect(
      createService().getProviderContractParticipationStatus(providerId),
    ).resolves.toMatchObject({ status: 'CONTRACT_ACTIVE' });
  });

  it('suspends an acceptance recorded by a user other than the provider owner', async () => {
    await expect(
      createService({ acceptedByUserId: new Types.ObjectId() })
        .getProviderContractParticipationStatus(providerId),
    ).resolves.toMatchObject({
      status: 'CONTRACT_SUSPENDED',
      reason: 'ACCEPTOR_MISMATCH',
    });
  });

  it('suspends an acceptance whose mechanism version is stale even when its hash matches', async () => {
    await expect(
      createService({ mechanismVersion: 'mechanism-v1' })
        .getProviderContractParticipationStatus(providerId),
    ).resolves.toMatchObject({
      status: 'CONTRACT_SUSPENDED',
      reason: 'MECHANISM_CHANGED',
    });
  });
});
