import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ContractReadService } from './contract-read.service';
import { ContractConsentService } from './contract-consent.service';
import { ProviderContractApprovalService } from './provider-contract-approval.service';
import { ContractEvidenceService } from './contract-evidence.service';
import { ProviderContractPolicyService } from './provider-contract-policy.service';
import { ProviderContractConfigService } from './provider-contract-config.service';
import {
  ContractConsentDto,
  ProviderAcceptMechanismDto,
} from './dto/contract-consent.dto';
import {
  AdminReviewPolicyDto,
  SaveProviderPolicyDraftDto,
} from './dto/provider-contract-policy.dto';
import { UpdateProviderContractConfigDto } from './dto/provider-contract-config.dto';
import { CheckContractEligibilityDto } from './dto/contract-eligibility.dto';

@Controller(['contracts', 'api/contracts'])
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(
    private readonly reads: ContractReadService,
    private readonly consents: ContractConsentService,
    private readonly providerApproval: ProviderContractApprovalService,
    private readonly providerPolicy: ProviderContractPolicyService,
    private readonly providerConfigService: ProviderContractConfigService,
    private readonly evidence: ContractEvidenceService,
  ) {}

  @Get('provider/config')
  providerConfig(@CurrentUser() user: AuthUser) {
    return this.providerConfigService.getConfig(user);
  }

  @Put('provider/config')
  updateProviderConfig(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateProviderContractConfigDto,
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.providerConfigService.updateConfig(user, body, { ipAddress, userAgent });
  }

  @Get('provider/config/audit')
  providerConfigAudit(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.providerConfigService.getAuditHistory(user, parsedLimit);
  }

  @Get('provider/policy/current')
  currentPolicy(@CurrentUser() user: AuthUser) {
    return this.providerPolicy.getCurrentPolicy(user);
  }

  @Get('provider/policy/versions')
  policyVersions(@CurrentUser() user: AuthUser) {
    return this.providerPolicy.getVersions(user);
  }

  @Post('provider/policy/draft')
  savePolicyDraft(
    @CurrentUser() user: AuthUser,
    @Body() body: SaveProviderPolicyDraftDto,
  ) {
    return this.providerPolicy.saveDraft(user, body);
  }

  @Post('provider/policy/submit')
  submitPolicyReview(
    @CurrentUser() user: AuthUser,
    @Body() body: SaveProviderPolicyDraftDto,
  ) {
    return this.providerPolicy.submitForReview(user, body);
  }

  @Get('admin/policies/pending')
  adminPendingPolicies(@CurrentUser() user: AuthUser) {
    return this.providerPolicy.getPendingPoliciesForAdmin(user);
  }

  @Get('admin/policies/:id')
  adminPolicyDetail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.providerPolicy.getPolicyDetailForAdmin(user, id);
  }

  @Post('admin/policies/:id/review')
  adminReviewPolicy(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: AdminReviewPolicyDto,
  ) {
    return this.providerPolicy.adminReview(user, id, body);
  }

  @Get('provider/mechanism')
  mechanism(@CurrentUser() user: AuthUser) {
    return this.providerApproval.mechanismForProvider(user);
  }

  @Get('provider/acceptance')
  providerStatus(@CurrentUser() user: AuthUser) {
    return this.providerApproval.status(user);
  }

  @Post('provider/acceptance')
  acceptMechanism(
    @CurrentUser() user: AuthUser,
    @Body() body: ProviderAcceptMechanismDto,
  ) {
    return this.providerApproval.accept(user, body.mechanismHash);
  }

  @Post('provider/acceptance/revoke')
  revokeMechanism(@CurrentUser() user: AuthUser) {
    return this.providerApproval.revoke(user);
  }

  @Get('bookings/:bookingId/readiness')
  readiness(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.reads.readiness(user, bookingId);
  }

  @Post('bookings/:bookingId/refresh-contracts')
  refreshContracts(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.reads.refreshContractsForBooking(user, bookingId);
  }

  @Post('eligibility/check')
  checkEligibility(@Body() body: CheckContractEligibilityDto) {
    return this.reads.checkEligibility(body.items);
  }

  @Get('customer/my-contracts')
  myContracts(@CurrentUser() user: AuthUser) {
    return this.reads.getMyContracts(user);
  }

  @Get('bookings/:bookingId')
  list(@CurrentUser() user: AuthUser, @Param('bookingId') bookingId: string) {
    return this.reads.listForBooking(user, bookingId);
  }

  @Get(':contractId')
  get(@CurrentUser() user: AuthUser, @Param('contractId') contractId: string) {
    return this.reads.get(user, contractId);
  }

  @Get(':contractId/pdf')
  async downloadPdf(
    @CurrentUser() user: AuthUser,
    @Param('contractId') contractId: string,
    @Res() res: Response,
  ) {
    const { stream, filename, sha256 } = await this.evidence.getPdfStream(user, contractId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Contract-SHA256', sha256);
    res.setHeader('Access-Control-Expose-Headers', 'X-Contract-SHA256, Content-Disposition');
    res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');
    stream.pipe(res);
  }

  @Get(':contractId/versions/:versionId/pdf')
  async downloadVersionPdf(
    @CurrentUser() user: AuthUser,
    @Param('contractId') contractId: string,
    @Param('versionId') versionId: string,
    @Res() res: Response,
  ) {
    const { stream, filename, sha256 } = await this.evidence.getPdfStream(user, contractId, versionId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Contract-SHA256', sha256);
    res.setHeader('Access-Control-Expose-Headers', 'X-Contract-SHA256, Content-Disposition');
    res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');
    stream.pipe(res);
  }

  @Get(':contractId/evidence')
  getEvidence(
    @CurrentUser() user: AuthUser,
    @Param('contractId') contractId: string,
  ) {
    return this.evidence.getEvidence(user, contractId);
  }

  @Get(':contractId/versions/:versionId/evidence')
  getVersionEvidence(
    @CurrentUser() user: AuthUser,
    @Param('contractId') contractId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.evidence.getEvidence(user, contractId, versionId);
  }

  @Post(':contractId/consents')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('contractId') contractId: string,
    @Body() body: ContractConsentDto,
    @Req() request: Request,
  ) {
    return this.consents.decide(user, contractId, body, {
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    });
  }
}
