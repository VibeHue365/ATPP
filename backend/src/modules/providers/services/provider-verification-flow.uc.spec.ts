import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ProviderCapability, ProviderStatus } from '../schemas/provider.schema';
import {
  DocumentUploadStatus,
  ProviderDocumentType,
  VerificationStatus,
  VerificationType,
} from '../schemas/provider-verification.schema';
import { ProviderVerificationService } from './provider-verification.service';

type Row = Record<string, any>;

const meta = { ip: '127.0.0.1', userAgent: 'jest' } as any;
const userId = new Types.ObjectId();
const customer = {
  sub: userId.toString(),
  email: 'shop@example.com',
  roles: ['CUSTOMER'],
} as any;
const admin = {
  sub: new Types.ObjectId().toString(),
  email: 'admin@example.com',
  roles: ['ADMIN'],
} as any;

function uploadedDocument(documentType: ProviderDocumentType) {
  return {
    documentType,
    required: true,
    versions: [
      {
        versionNo: 1,
        isCurrent: true,
        uploadStatus: DocumentUploadStatus.Uploaded,
      },
    ],
  };
}

function verification(overrides: Row = {}): Row {
  return {
    _id: new Types.ObjectId(),
    userId,
    status: VerificationStatus.Draft,
    verificationType: VerificationType.NewProvider,
    requestedCapabilities: [ProviderCapability.AoDaiRental],
    businessProfile: {
      businessName: 'Hue Ao Dai',
      ownerName: 'Nguyen Van A',
      phone: '0901234567',
      email: 'shop@example.com',
      address: '12 Le Loi',
      province: 'Hue',
    },
    aodaiInfo: {
      shopName: 'Hue Ao Dai',
      rentalPolicy: '3 days',
      depositPolicy: '30%',
      pickupAddress: '12 Le Loi',
      sizeSupport: 'S-XL',
    },
    photographyInfo: {},
    consent: { accepted: true },
    documents: [
      uploadedDocument(ProviderDocumentType.IdentityCardFront),
      uploadedDocument(ProviderDocumentType.IdentityCardBack),
      uploadedDocument(ProviderDocumentType.ShopPhotoProof),
    ],
    statusTimeline: [],
    review: null,
    verificationRevision: 1,
    save: jest.fn().mockResolvedValue(undefined),
    markModified: jest.fn(),
    ...overrides,
  };
}

function createService(
  options: {
    user?: Row | null;
    activeProvider?: Row | null;
    duplicate?: Row | null;
    current?: Row | null;
  } = {},
) {
  const verificationModel = {
    findOne: jest.fn().mockResolvedValue(options.duplicate ?? null),
    findById: jest
      .fn()
      .mockResolvedValue(
        options.current === undefined ? verification() : options.current,
      ),
    create: jest
      .fn()
      .mockImplementation(async (data: Row) => ({
        _id: new Types.ObjectId(),
        ...data,
      })),
  };
  const providerModel = {
    findOne: jest.fn().mockResolvedValue(options.activeProvider ?? null),
    create: jest
      .fn()
      .mockImplementation(async (data: Row) => ({
        _id: new Types.ObjectId(),
        ...data,
      })),
  };
  const userModel = {
    findById: jest
      .fn()
      .mockResolvedValue(
        options.user === undefined
          ? { _id: userId, auth: { emailVerified: true } }
          : options.user,
      ),
    findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
  };
  const auditLogModel = { create: jest.fn().mockResolvedValue({}) };
  const notificationModel = { create: jest.fn().mockResolvedValue({}) };
  const service = new ProviderVerificationService(
    verificationModel as any,
    providerModel as any,
    userModel as any,
    auditLogModel as any,
    notificationModel as any,
    {} as any,
    { exists: jest.fn().mockResolvedValue(false) } as any,
    { get: jest.fn((_key: string, fallback?: string) => fallback) } as any,
    {} as any,
  );
  return {
    service,
    verificationModel,
    providerModel,
    userModel,
    auditLogModel,
    notificationModel,
  };
}

describe('UC-08 Upgrade Provider Account (HuyLDN)', () => {
  const aoDai = {
    requestedCapabilities: [ProviderCapability.AoDaiRental],
  } as any;

  it('UT-08 UTCID03 requires a CUSTOMER or PROVIDER role', async () => {
    const { service } = createService();

    await expect(
      service.createVerification(
        { ...customer, roles: ['ADMIN'] },
        aoDai,
        meta,
      ),
    ).rejects.toThrow(
      new ForbiddenException('CUSTOMER or PROVIDER role is required'),
    );
  });

  it('UT-08 UTCID04 requires a verified email before applying', async () => {
    const { service, verificationModel } = createService({
      user: { _id: userId, auth: { emailVerified: false } },
    });

    await expect(
      service.createVerification(customer, aoDai, meta),
    ).rejects.toThrow(new BadRequestException('Email must be verified'));
    expect(verificationModel.create).not.toHaveBeenCalled();
  });

  it('UT-08 UTCID05 rejects duplicated requested capabilities', async () => {
    const { service } = createService();

    await expect(
      service.createVerification(
        customer,
        {
          requestedCapabilities: [
            ProviderCapability.Photography,
            ProviderCapability.Photography,
          ],
        } as any,
        meta,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'requestedCapabilities must not contain duplicates',
      ),
    );
  });

  it('UT-08 UTCID06 rejects an empty capability list', async () => {
    const { service } = createService();

    await expect(
      service.createVerification(
        customer,
        { requestedCapabilities: [] } as any,
        meta,
      ),
    ).rejects.toThrow(
      new BadRequestException('requestedCapabilities must not be empty'),
    );
  });

  it('UT-08 UTCID07 creates a draft application with the documents required for Ao Dai rental', async () => {
    const { service, verificationModel, auditLogModel } = createService();

    const result = await service.createVerification(customer, aoDai, meta);

    expect(verificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: VerificationStatus.Draft,
        verificationType: VerificationType.NewProvider,
      }),
    );
    expect(result.requiredDocuments).toEqual([
      ProviderDocumentType.IdentityCardFront,
      ProviderDocumentType.IdentityCardBack,
      ProviderDocumentType.ShopPhotoProof,
    ]);
    expect(auditLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_PROVIDER_VERIFICATION' }),
    );
  });

  it('UT-08 UTCID08 rejects a capability the provider already owns', async () => {
    const { service } = createService({
      activeProvider: {
        _id: new Types.ObjectId(),
        capabilities: [ProviderCapability.AoDaiRental],
      },
    });

    await expect(
      service.createVerification(
        { ...customer, roles: ['PROVIDER'] },
        aoDai,
        meta,
      ),
    ).rejects.toThrow(
      new BadRequestException('Bạn đã sở hữu vai trò dịch vụ này rồi.'),
    );
  });

  it('UT-08 UTCID09 creates an add-capability request for an existing provider', async () => {
    const { service, verificationModel } = createService({
      activeProvider: {
        _id: new Types.ObjectId(),
        capabilities: [ProviderCapability.AoDaiRental],
      },
    });

    await service.createVerification(
      { ...customer, roles: ['PROVIDER'] },
      { requestedCapabilities: [ProviderCapability.Photography] } as any,
      meta,
    );

    expect(verificationModel.create.mock.calls[0][0]).toMatchObject({
      verificationType: VerificationType.AddCapability,
      requestedCapabilities: [ProviderCapability.Photography],
    });
  });

  it('UT-08 UTCID10 blocks a second active application of the same type', async () => {
    const { service } = createService({
      duplicate: { _id: new Types.ObjectId() },
    });

    await expect(
      service.createVerification(customer, aoDai, meta),
    ).rejects.toThrow(
      new ConflictException('Active provider verification already exists'),
    );
  });

  it('UT-08 UTCID11 submits a complete application and notifies the applicant', async () => {
    const draft = verification();
    const { service, notificationModel } = createService({ current: draft });

    const result = await service.submitVerification(
      customer,
      draft._id.toString(),
      meta,
    );

    expect(result.status).toBe(VerificationStatus.Submitted);
    expect(draft.save).toHaveBeenCalled();
    expect(draft.statusTimeline.at(-1)).toMatchObject({
      fromStatus: VerificationStatus.Draft,
      toStatus: VerificationStatus.Submitted,
    });
    expect(notificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hồ sơ đăng ký đối tác đã được gửi' }),
    );
  });

  it('UT-08 UTCID12 rejects submission before the consent is accepted', async () => {
    const draft = verification({ consent: { accepted: false } });
    const { service } = createService({ current: draft });

    await expect(
      service.submitVerification(customer, draft._id.toString(), meta),
    ).rejects.toThrow(new BadRequestException('Consent not accepted'));
  });

  it('UT-08 UTCID13 rejects submission while a required document is not uploaded', async () => {
    const draft = verification();
    draft.documents[2].versions[0].uploadStatus =
      DocumentUploadStatus.UploadFailed;
    const { service } = createService({ current: draft });

    await expect(
      service.submitVerification(customer, draft._id.toString(), meta),
    ).rejects.toThrow(
      new BadRequestException(
        `Required document ${ProviderDocumentType.ShopPhotoProof} is not uploaded`,
      ),
    );
  });

  it('UT-08 UTCID14 rejects submission with a missing business phone', async () => {
    const draft = verification();
    draft.businessProfile.phone = '';
    const { service } = createService({ current: draft });

    await expect(
      service.submitVerification(customer, draft._id.toString(), meta),
    ).rejects.toThrow(
      new BadRequestException('Missing required field businessProfile.phone'),
    );
  });

  it('UT-08 UTCID15 forbids submitting another user application', async () => {
    const draft = verification({ userId: new Types.ObjectId() });
    const { service } = createService({ current: draft });

    await expect(
      service.submitVerification(customer, draft._id.toString(), meta),
    ).rejects.toThrow(new ForbiddenException('Not owner'));
  });

  it('UT-08 UTCID16 rejects submitting an application that is already submitted', async () => {
    const submitted = verification({ status: VerificationStatus.Submitted });
    const { service } = createService({ current: submitted });

    await expect(
      service.submitVerification(customer, submitted._id.toString(), meta),
    ).rejects.toThrow(new ConflictException('Invalid verification status'));
  });
});

describe('UC-09 Verify Provider (HuyLDN)', () => {
  const decision = { reason: 'Hồ sơ hợp lệ' } as any;

  it('UT-09 UTCID06 allows only administrators to approve', async () => {
    const { service } = createService({
      current: verification({ status: VerificationStatus.Submitted }),
    });

    await expect(
      service.adminApprove(
        customer,
        new Types.ObjectId().toString(),
        decision,
        meta,
      ),
    ).rejects.toThrow(new ForbiddenException('ADMIN role is required'));
  });

  it('UT-09 UTCID07 rejects approving an application that was not submitted', async () => {
    const { service } = createService({
      current: verification({ status: VerificationStatus.Draft }),
    });

    await expect(
      service.adminApprove(
        admin,
        new Types.ObjectId().toString(),
        decision,
        meta,
      ),
    ).rejects.toThrow(new ConflictException('Invalid verification status'));
  });

  it('UT-09 UTCID08 creates an active provider and grants the PROVIDER role on approval', async () => {
    const submitted = verification({ status: VerificationStatus.Submitted });
    const { service, providerModel, userModel } = createService({
      current: submitted,
    });

    const result = await service.adminApprove(
      admin,
      submitted._id.toString(),
      decision,
      meta,
    );

    expect(providerModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        businessName: 'Hue Ao Dai',
        capabilities: [ProviderCapability.AoDaiRental],
        status: ProviderStatus.Active,
      }),
    );
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ $addToSet: { roles: 'PROVIDER' } }),
    );
    expect(result).toMatchObject({
      verification: { status: VerificationStatus.Approved },
      user: { rolesAdded: ['PROVIDER'] },
    });
  });

  it('UT-09 UTCID09 rejects creating a second active provider for the same user', async () => {
    const { service } = createService({
      current: verification({ status: VerificationStatus.Submitted }),
      activeProvider: { _id: new Types.ObjectId(), capabilities: [] },
    });

    await expect(
      service.adminApprove(
        admin,
        new Types.ObjectId().toString(),
        decision,
        meta,
      ),
    ).rejects.toThrow(
      new ConflictException('User already has an active provider'),
    );
  });

  it('UT-09 UTCID10 merges new capabilities into the existing provider for an upgrade', async () => {
    const existing = {
      _id: new Types.ObjectId(),
      status: ProviderStatus.Active,
      capabilities: [ProviderCapability.Photography],
      policies: {},
      save: jest.fn().mockImplementation(function (this: Row) {
        return Promise.resolve(this);
      }),
    };
    const upgrade = verification({
      status: VerificationStatus.UnderReview,
      verificationType: VerificationType.AddCapability,
    });
    const { service, providerModel } = createService({
      current: upgrade,
      activeProvider: existing,
    });

    await service.adminApprove(admin, upgrade._id.toString(), decision, meta);

    expect(existing.capabilities).toEqual([
      ProviderCapability.Photography,
      ProviderCapability.AoDaiRental,
    ]);
    expect(existing.policies).toEqual({ rentalPolicy: '3 days' });
    expect(providerModel.create).not.toHaveBeenCalled();
  });

  it('UT-09 UTCID11 rejects an upgrade when the provider account is no longer active', async () => {
    const { service } = createService({
      current: verification({
        status: VerificationStatus.Submitted,
        verificationType: VerificationType.AddCapability,
      }),
      activeProvider: null,
    });

    await expect(
      service.adminApprove(
        admin,
        new Types.ObjectId().toString(),
        decision,
        meta,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('UT-09 UTCID12 requires a reason to reject an application', async () => {
    const { service } = createService({
      current: verification({ status: VerificationStatus.Submitted }),
    });

    await expect(
      service.adminReject(
        admin,
        new Types.ObjectId().toString(),
        {} as any,
        meta,
      ),
    ).rejects.toThrow(new BadRequestException('Reject reason is required'));
  });

  it('UT-09 UTCID13 rejects an application and notifies the applicant', async () => {
    const submitted = verification({ status: VerificationStatus.Submitted });
    const { service, notificationModel } = createService({
      current: submitted,
    });

    const result = await service.adminReject(
      admin,
      submitted._id.toString(),
      { reason: 'Ảnh CCCD mờ' } as any,
      meta,
    );

    expect(result.status).toBe(VerificationStatus.Rejected);
    expect(submitted.review).toMatchObject({ reason: 'Ảnh CCCD mờ' });
    expect(notificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hồ sơ đăng ký đối tác bị từ chối' }),
    );
  });

  it('UT-09 UTCID14 requires a reason or a change request to ask for changes', async () => {
    const { service } = createService({
      current: verification({ status: VerificationStatus.Submitted }),
    });

    await expect(
      service.adminRequestChanges(
        admin,
        new Types.ObjectId().toString(),
        { changeRequests: [] } as any,
        meta,
      ),
    ).rejects.toThrow(
      new BadRequestException('At least one change request is required'),
    );
  });

  it('UT-09 UTCID15 moves an application to NEEDS_CHANGES with the admin reason', async () => {
    const submitted = verification({ status: VerificationStatus.UnderReview });
    const { service, notificationModel } = createService({
      current: submitted,
    });

    const result = await service.adminRequestChanges(
      admin,
      submitted._id.toString(),
      { reason: 'Bổ sung ảnh cửa hàng' } as any,
      meta,
    );

    expect(result.status).toBe(VerificationStatus.NeedsChanges);
    expect(notificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hồ sơ đăng ký đối tác cần bổ sung' }),
    );
  });
});
