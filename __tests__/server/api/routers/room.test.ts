import { EventEmitter } from "events";
import { roomRouter } from "~/server/api/routers/room";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto, { randomUUID } from "crypto";

// mocking crypto to have predictable uuids in tests
vi.mock('crypto', () => ({
    randomUUID: vi.fn(() => 'test-uuid-1234'),
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
                create: vi.fn().mockResolvedValue({}),
                delete: vi.fn().mockResolvedValue({}),
            },
            message: {
                create: vi.fn().mockResolvedValue({}),
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
        vi.clearAllMocks();
    });

    it('should handle user joining, receiving messages, and disconnecting', async () => {
        const ac = new AbortController();
        const input = { roomId: 'abcd', name: 'ChesterTester' };
        
        // init trpc server caller with mocked context
        const caller = roomRouter.createCaller(mockCtx);

        // call procedure, passing abort signal
        const iterable = await caller.onSendMessage(input);

        // convert to async iterator to call .next()
        const iterator = iterable as AsyncGenerator<any>;

        // verify join phase
        const joinResult = await iterator.next();

        expect(joinResult.value).toMatchObject({
            sender: 'SYSTEM',
            message: 'ChesterTester has joined the chat.',
            roomId: 'abcd',
        });
        expect(mockDb.participant.create).toHaveBeenCalledWith({
            data: { name: 'ChesterTester', roomId: 'abcd' },
        });

        // verify message listening phase
        const chatMsg = {
            id: 'msg-1',
            roomId: 'abcd',
            message: 'Hello World!',
            createdAt: new Date(),
            sender: 'user-123',
        };

        mockCtx.ee.emit('SEND_MESSAGE', chatMsg);

        const chatResult = await iterator.next();
        expect(chatResult.value).toEqual(chatMsg);

        // verify dc/cleanup (finally)
        await iterator.return(undefined);

        expect(mockDb.message.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    message: 'ChesterTester has left the chat.',
                    sender: 'SYSTEM',
                }),
            })
        );
    });
})