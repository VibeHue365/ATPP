import { MongoClient, ObjectId } from 'mongodb';

const testUri = process.env.MONGODB_HOLD_TEST_URI;
const runE2e = process.env.RUN_PHOTOGRAPHY_HOLD_E2E === 'true' && !!testUri;
const describeHoldE2e = runE2e ? describe : describe.skip;

/**
 * Opt-in integration coverage for the two invariants that mocks cannot prove:
 * a provider/day write lock serializes overlapping holds, and a transaction
 * rolls back every resource of a failed combo hold. This test always uses a
 * timestamped throwaway database; it never reads the application database.
 */
describeHoldE2e('photography hold concurrency (MongoDB replica set)', () => {
  let client: MongoClient;
  let databaseName: string;

  beforeAll(async () => {
    client = new MongoClient(testUri!);
    await client.connect();
    databaseName = `vibehue_photography_hold_e2e_${Date.now()}`;

    await client
      .db(databaseName)
      .collection('provider_schedule_locks')
      .createIndex({ providerId: 1, providerLocalDate: 1 }, { unique: true });
  });

  afterAll(async () => {
    if (client) {
      await client.db(databaseName).dropDatabase();
      await client.close();
    }
  });

  async function createOverlappingHold(
    providerId: ObjectId,
    bookingId: ObjectId,
  ): Promise<'held' | 'conflict'> {
    const locks = client.db(databaseName).collection('provider_schedule_locks');
    const schedules = client.db(databaseName).collection('booking_schedules');
    const session = client.startSession();
    const startsAt = new Date('2030-01-20T02:00:00.000Z');
    const endsAt = new Date('2030-01-20T04:00:00.000Z');

    try {
      let result: 'held' | 'conflict' = 'conflict';
      await session.withTransaction(async () => {
        await locks.findOneAndUpdate(
          { providerId, providerLocalDate: '2030-01-20' },
          {
            $setOnInsert: { providerId, providerLocalDate: '2030-01-20' },
            $inc: { version: 1 },
          },
          { upsert: true, session },
        );

        const overlap = await schedules.findOne(
          {
            providerId,
            providerLocalDate: '2030-01-20',
            scheduleType: 'PHOTOSHOOT',
            $or: [
              { status: 'CONFIRMED' },
              { status: 'HELD', holdExpiresAt: { $gt: new Date() } },
            ],
            startsAt: { $lt: endsAt },
            endsAt: { $gt: startsAt },
          },
          { session },
        );
        if (overlap) {
          result = 'conflict';
          return;
        }

        await schedules.insertOne(
          {
            bookingId,
            providerId,
            scheduleType: 'PHOTOSHOOT',
            providerLocalDate: '2030-01-20',
            startsAt,
            endsAt,
            status: 'HELD',
            holdExpiresAt: new Date(Date.now() + 60_000),
          },
          { session },
        );
        result = 'held';
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  it('allows only one concurrent hold for the same overlapping slot', async () => {
    const providerId = new ObjectId();
    const results = await Promise.all([
      createOverlappingHold(providerId, new ObjectId()),
      createOverlappingHold(providerId, new ObjectId()),
    ]);

    expect(results.filter((result) => result === 'held')).toHaveLength(1);
    expect(
      await client
        .db(databaseName)
        .collection('booking_schedules')
        .countDocuments({ providerId }),
    ).toBe(1);
  });

  it('rolls back every combo resource when an inventory reservation fails', async () => {
    const session = client.startSession();
    const bookingId = new ObjectId();

    await expect(
      session.withTransaction(async () => {
        await client
          .db(databaseName)
          .collection('bookings')
          .insertOne({ _id: bookingId, bookingType: 'COMBO' }, { session });
        await client
          .db(databaseName)
          .collection('booking_schedules')
          .insertOne({ bookingId, status: 'HELD' }, { session });
        throw new Error('Simulated inventory reservation failure');
      }),
    ).rejects.toThrow('Simulated inventory reservation failure');
    await session.endSession();

    expect(
      await client.db(databaseName).collection('bookings').countDocuments({ _id: bookingId }),
    ).toBe(0);
    expect(
      await client
        .db(databaseName)
        .collection('booking_schedules')
        .countDocuments({ bookingId }),
    ).toBe(0);
  });
});
