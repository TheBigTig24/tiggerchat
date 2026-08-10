import { EventEmitter } from "events";
import { roomRouter } from "~/server/api/routers/room";
import crypto, { randomUUID } from "crypto";

// mocking crypto to have predictable uuids in tests
jest.mock('crypto', () => ({
    randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

describe('Room Routes', () => {
    let mockDb: any;
    let ee: EventEmitter;
    let mockCtx: any;

    beforeEach(() => {
        // setup a real event emitter so we can emit events in the test
        ee = new EventEmitter();

        // mock prisma db methods
        mockDb = {
            participant: {
                create: jest.fn().mockResolvedValue({}),
                delete: jest.fn().mockResolvedValue({}),
            },
            message: {
                create: jest.fn().mockResolvedValue({}),
            },
        };

        // construct the mocked context
        mockCtx = {
            db: mockDb,
            ee: ee,
            session: {
                user: { id: 'user-123' },
            },
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should handle user joining, receiving messages, and disconnecting', async () => {
        const ac = new AbortController();
        const input = { roomId: 'abcd', name: 'ChesterTester' };
        
        // init trpc server caller with mocked context
    })
})