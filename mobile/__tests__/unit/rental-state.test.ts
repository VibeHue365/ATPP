import type { Booking } from '@/types/booking';
import {
  computeProviderOrderCounts,
  getBookingStateSignature,
  getItemSkuOrCode,
  getReturnEligibleRentalItems,
  hasPickupEvidence,
  matchesProviderOrderFilter,
  resolveBookingDisplayState,
  resolveRentalItemStage,
} from '@/utils/rentalState';

const makeRentalBooking = (
  overrides: Partial<Booking> = {},
  itemOverrides: Record<string, any> = {},
): Partial<Booking> => ({
  _id: 'bk-100',
  bookingCode: 'VH-100',
  bookingType: 'AODAI_RENTAL',
  status: 'CONFIRMED',
  items: [
    {
      _id: 'item-1',
      itemType: 'PRODUCT',
      unitPrice: 250000,
      quantity: 1,
      isMyItem: true,
      ...itemOverrides,
    } as any,
  ],
  ...overrides,
});

describe('rentalState helper', () => {
  it('resolves all rental item lifecycle stages accurately', () => {
    const draft = makeRentalBooking({ status: 'DRAFT' });
    expect(resolveBookingDisplayState(draft, 'customer').stage).toBe('DRAFT');

    const pendingPay = makeRentalBooking({ status: 'PENDING_PAYMENT' });
    expect(resolveBookingDisplayState(pendingPay, 'customer').stage).toBe('PENDING_PAYMENT');

    const depPaid = makeRentalBooking({ status: 'DEPOSIT_PAID' });
    expect(resolveBookingDisplayState(depPaid, 'provider').stage).toBe('DEPOSIT_PAID');
    expect(resolveBookingDisplayState(depPaid, 'provider').actionRequired).toBe(true);

    const preparing = makeRentalBooking(
      { status: 'CONFIRMED' },
      { rentalFulfillment: { status: 'PENDING' } },
    );
    expect(resolveBookingDisplayState(preparing, 'provider').stage).toBe('PREPARING');
    expect(resolveBookingDisplayState(preparing, 'provider').actionRequired).toBe(true);
    expect(resolveBookingDisplayState(preparing, 'customer').actionRequired).toBe(false);

    const readyNoPhotos = makeRentalBooking(
      { status: 'PICKUP_PENDING' },
      { rentalFulfillment: { status: 'READY_FOR_PICKUP' } },
    );
    expect(resolveBookingDisplayState(readyNoPhotos, 'provider').stage).toBe(
      'READY_NEEDS_HANDOVER_PHOTOS',
    );
    expect(resolveBookingDisplayState(readyNoPhotos, 'customer').actionRequired).toBe(false);

    const readyWithPhotos = makeRentalBooking(
      { status: 'PICKUP_PENDING' },
      {
        rentalFulfillment: {
          status: 'READY_FOR_PICKUP',
          pickupEvidence: {
            files: ['/api/bookings/bk-100/rental/evidence/f-1'],
          },
        },
      },
    );
    expect(resolveBookingDisplayState(readyWithPhotos, 'customer').stage).toBe(
      'HANDOVER_AWAITING_CUSTOMER',
    );
    expect(resolveBookingDisplayState(readyWithPhotos, 'customer').actionRequired).toBe(true);
    expect(resolveBookingDisplayState(readyWithPhotos, 'provider').actionRequired).toBe(false);

    const inRental = makeRentalBooking(
      { status: 'PICKED_UP' },
      { rentalFulfillment: { status: 'PICKED_UP' } },
    );
    expect(resolveBookingDisplayState(inRental, 'customer').stage).toBe('IN_RENTAL');

    const customerReturn = makeRentalBooking(
      { status: 'RETURN_PENDING' },
      { rentalFulfillment: { status: 'CUSTOMER_RETURN_REQUESTED' } },
    );
    const custRetProvider = resolveBookingDisplayState(customerReturn, 'provider');
    expect(custRetProvider.stage).toBe('CUSTOMER_RETURN_REQUESTED');
    expect(custRetProvider.shortLabel).toBe('Chờ nhận lại');
    expect(custRetProvider.actionRequired).toBe(true);
    expect(custRetProvider.hasIncident).toBe(false);

    const incidentPending = makeRentalBooking(
      {
        status: 'RETURN_PENDING',
        hasIncident: true,
        activeIncident: { _id: 'inc-1', status: 'PENDING_CUSTOMER' },
      },
      { rentalFulfillment: { status: 'RETURNED', issueStatus: 'REPORTED' } },
    );
    const incCustomer = resolveBookingDisplayState(incidentPending, 'customer');
    expect(incCustomer.stage).toBe('INCIDENT_PENDING_CUSTOMER');
    expect(incCustomer.hasIncident).toBe(true);
    expect(incCustomer.actionRequired).toBe(true);

    const returnedNeedsInspection = makeRentalBooking(
      { status: 'RETURNED' },
      {
        rentalFulfillment: {
          status: 'RETURNED',
          inventoryStatus: 'IN_STOCK',
          depositSettlementStatus: 'HELD',
        },
      },
    );
    expect(resolveBookingDisplayState(returnedNeedsInspection, 'provider').stage).toBe(
      'RETURNED_NEEDS_INSPECTION',
    );

    const cleaningAfterRefund = makeRentalBooking(
      { status: 'RETURNED' },
      {
        rentalFulfillment: {
          status: 'RETURNED',
          inventoryStatus: 'CLEANING',
          depositSettlementStatus: 'FULLY_RELEASED',
        },
      },
    );
    expect(resolveBookingDisplayState(cleaningAfterRefund, 'provider').stage).toBe(
      'CLEANING_AFTER_REFUND',
    );
    expect(resolveBookingDisplayState(cleaningAfterRefund, 'provider').tone).toBe('info');

    const completed = makeRentalBooking(
      { status: 'COMPLETED' },
      { rentalFulfillment: { status: 'COMPLETED' } },
    );
    expect(resolveBookingDisplayState(completed, 'customer').stage).toBe('COMPLETED');
    expect(resolveBookingDisplayState(completed, 'customer').tone).toBe('success');
  });

  it('checks pickup evidence and SKU formatting correctly', () => {
    expect(
      hasPickupEvidence(
        {
          _id: 'i1',
          rentalFulfillment: {
            status: 'READY_FOR_PICKUP',
            pickupEvidence: { files: ['/api/bookings/bk-100/rental/evidence/f1'] },
          },
        },
        null,
      ),
    ).toBe(true);

    expect(
      getItemSkuOrCode({
        _id: '6789abcdef12',
        inventoryItem: { _id: 'inv-1', sku: 'TAG-065' },
      }),
    ).toBe('TAG-065');

    expect(getItemSkuOrCode({ _id: '6789abcdef12' })).toBe('#DEF12');
  });

  it('computes consistent provider filter counts and matchesProviderOrderFilter', () => {
    const orders: Partial<Booking>[] = [
      makeRentalBooking({ _id: '1', status: 'DEPOSIT_PAID' }),
      makeRentalBooking(
        { _id: '2', status: 'CONFIRMED' },
        { rentalFulfillment: { status: 'PENDING' } },
      ),
      makeRentalBooking(
        { _id: '3', status: 'PICKED_UP' },
        { rentalFulfillment: { status: 'PICKED_UP' } },
      ),
      makeRentalBooking(
        { _id: '4', status: 'RETURN_PENDING' },
        { rentalFulfillment: { status: 'CUSTOMER_RETURN_REQUESTED' } },
      ),
      makeRentalBooking(
        { _id: '5', status: 'RETURNED' },
        {
          rentalFulfillment: {
            status: 'RETURNED',
            inventoryStatus: 'CLEANING',
            depositSettlementStatus: 'FULLY_RELEASED',
          },
        },
      ),
      makeRentalBooking({ _id: '6', status: 'PENDING_PAYMENT' }),
      makeRentalBooking({ _id: '7', status: 'COMPLETED' }),
    ];

    const counts = computeProviderOrderCounts(orders);
    expect(counts).toEqual({
      all: 7,
      urgent: 4, // DEPOSIT_PAID, PREPARING, CUSTOMER_RETURN_REQUESTED, CLEANING_AFTER_REFUND
      pickup: 2, // DEPOSIT_PAID, PREPARING
      rented: 1, // IN_RENTAL
      refund: 2, // CUSTOMER_RETURN_REQUESTED, CLEANING_AFTER_REFUND
      pending_payment: 1,
      completed: 1,
    });

    expect(matchesProviderOrderFilter(orders[0], 'urgent')).toBe(true);
    expect(matchesProviderOrderFilter(orders[2], 'rented')).toBe(true);
    expect(matchesProviderOrderFilter(orders[3], 'refund')).toBe(true);
    expect(matchesProviderOrderFilter(orders[5], 'pending_payment')).toBe(true);
    expect(matchesProviderOrderFilter(orders[6], 'completed')).toBe(true);
  });

  it('produces distinct state signatures across item stage or evidence changes', () => {
    const b1 = makeRentalBooking(
      { _id: 'b1', status: 'PICKUP_PENDING' },
      { _id: 'i1', rentalFulfillment: { status: 'READY_FOR_PICKUP' } },
    );
    const b2 = makeRentalBooking(
      { _id: 'b1', status: 'PICKUP_PENDING' },
      {
        _id: 'i1',
        rentalFulfillment: {
          status: 'READY_FOR_PICKUP',
          pickupEvidence: { files: ['/api/bookings/b1/rental/evidence/f1'] },
        },
      },
    );
    const b3 = makeRentalBooking(
      { _id: 'b1', status: 'RETURN_PENDING' },
      { _id: 'i1', rentalFulfillment: { status: 'CUSTOMER_RETURN_REQUESTED' } },
    );

    expect(resolveRentalItemStage(b1, b1.items?.[0])).toBe('READY_NEEDS_HANDOVER_PHOTOS');
    expect(resolveRentalItemStage(b2, b2.items?.[0])).toBe('HANDOVER_AWAITING_CUSTOMER');
    expect(getBookingStateSignature(b1)).not.toBe(getBookingStateSignature(b2));
    expect(getBookingStateSignature(b2)).not.toBe(getBookingStateSignature(b3));
  });

  it('surfaces active rental stages in COMBO_PHOTOS_APPROVED and filters return-eligible items per item status', () => {
    const comboStillInRental: Partial<Booking> = {
      _id: 'combo-1',
      bookingCode: 'VH-COMBO1',
      bookingType: 'COMBO',
      status: 'COMBO_PHOTOS_APPROVED',
      items: [
        {
          _id: 'r1',
          itemType: 'PRODUCT',
          unitPrice: 300000,
          quantity: 1,
          rentalFulfillment: { status: 'PICKED_UP' },
        } as any,
        {
          _id: 'p1',
          itemType: 'PHOTOGRAPHY_PACKAGE',
          unitPrice: 500000,
          quantity: 1,
        } as any,
      ],
    };

    expect(resolveBookingDisplayState(comboStillInRental, 'provider').stage).toBe('IN_RENTAL');
    expect(resolveBookingDisplayState(comboStillInRental, 'customer').stage).toBe('IN_RENTAL');

    const comboPhotosDoneRentalCompleted: Partial<Booking> = {
      _id: 'combo-2',
      bookingCode: 'VH-COMBO2',
      bookingType: 'COMBO',
      status: 'COMBO_PHOTOS_APPROVED',
      items: [
        {
          _id: 'r1',
          itemType: 'PRODUCT',
          unitPrice: 300000,
          quantity: 1,
          rentalFulfillment: { status: 'COMPLETED' },
        } as any,
        {
          _id: 'p1',
          itemType: 'PHOTOGRAPHY_PACKAGE',
          unitPrice: 500000,
          quantity: 1,
        } as any,
      ],
    };
    expect(resolveBookingDisplayState(comboPhotosDoneRentalCompleted, 'provider').stage).toBe(
      'COMBO_PHOTOS_APPROVED',
    );

    const multiDressPartialReturn: Partial<Booking> = {
      _id: 'multi-1',
      bookingType: 'AODAI_RENTAL',
      status: 'PICKED_UP',
      items: [
        {
          _id: 'dress-a',
          itemType: 'PRODUCT',
          unitPrice: 200000,
          quantity: 1,
          rentalFulfillment: { status: 'RETURNED' },
        } as any,
        {
          _id: 'dress-b',
          itemType: 'PRODUCT',
          unitPrice: 200000,
          quantity: 1,
          rentalFulfillment: { status: 'PICKED_UP' },
        } as any,
      ],
    };

    const eligible = getReturnEligibleRentalItems(multiDressPartialReturn);
    expect(eligible.map((it) => it._id)).toEqual(['dress-b']);
  });
});
