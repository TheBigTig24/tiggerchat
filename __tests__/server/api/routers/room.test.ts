import { EventEmitter } from "events";
import { roomRouter } from "~/server/api/routers/room";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto, { randomUUID } from "crypto";
import { Result } from "postcss";

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

        vi.spyOn(ee, 'emit');

        // mock prisma db methods
        mockDb = {
            participant: {
                create: vi.fn().mockResolvedValue({}),
                delete: vi.fn().mockResolvedValue({}),
            },
            message: {
                create: vi.fn().mockResolvedValue({}),
            },
            room: {
                findUnique: vi.fn().mockResolvedValue({}),
            }
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

    it('should handle sending messages', async () => {
        const input = {
            roomId: 'abcd',
            message: 'sup boss',
            name: 'ChesterTester',
        };

        const caller = roomRouter.createCaller(mockCtx);

        const result = await caller.sendMessage(input);

        // test expected return object
        expect(result.roomId).toBe(input.roomId);
        expect(result.message).toBe(input.message);
        expect(result.sender).toBe(input.name);

        // check that other params were generated
        expect(result.id).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
        
        // verify that the message was broadcasted
        expect(mockCtx.ee.emit).toHaveBeenCalledWith("SEND_MESSAGE", result);

        // verify db was called to save payload
        expect(mockCtx.db.message.create).toHaveBeenCalledWith({
            data: {
                id: result.id,
                createdAt: result.createdAt,
                roomId: result.roomId,
                sender: result.sender,
                message: result.message,
            }
        });
    });

    it('should check if a room exists', async () => {
        const input = {
            id: 'abcd',
        };

        const caller = roomRouter.createCaller(mockCtx);

        const result = await caller.checkRoomExists(input);

        expect(result.exists).toBe(true);
        expect(mockCtx.db.room.findUnique).toHaveBeenCalledWith({
            where: { id: input.id },
            select: { id: true }
        });
    });

    it(' should check if a room does not exist', async () => {
        mockCtx.db.room.findUnique.mockResolvedValue(null);

        const input = { id: 'abcd' };

        const caller = roomRouter.createCaller(mockCtx);

        const result = await caller.checkRoomExists(input);

        expect(result.exists).toBe(false);
        expect(mockCtx.db.room.findUnique).toHaveBeenCalledWith({
            where: { id: input.id },
            select: { id: true },
        });
    });

    it('should delete a participant from a room', async () => {
        
    });
});