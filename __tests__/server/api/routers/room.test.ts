import { EventEmitter } from "events";
import { roomRouter } from "~/server/api/routers/room";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto, { randomUUID } from "crypto";

vi.mock('next-auth', () => ({
    default: vi.fn(() => ({
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        handlers: vi.fn(),
    })),
}));

vi.mock('next/server', () => ({
    NextResponse: vi.fn(),
    NextRequest: vi.fn(),
}));

// mocking crypto to have predictable uuids in tests
vi.mock('crypto', async (importOriginal) => {
    const actual = await importOriginal<typeof import("crypto")>();
    return {
        ...actual,
        default: {
            ...actual,
            randomUUID: () => "mocked-id-1234",
        },
        randomUUID: () => "mocked-id-1234",
    };
});

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

        const chatResPromise = iterator.next();

        await new Promise((resolve) => setTimeout(resolve, 0));

        mockCtx.ee.emit('SEND_MESSAGE', chatMsg);

        const chatResult = await chatResPromise;
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
});