import { z } from "zod";
import { on } from "events";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import crypto from "crypto";
import type { Message } from "@prisma/client";

export const roomRouter = createTRPCRouter({
    sendMessage: protectedProcedure.input(
        z.object({
            roomId: z.string(),
            message: z.string(),
            name: z.string(),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const message: Message = {
            id: crypto.randomUUID(),
            roomId: input.roomId,
            message: input.message,
            createdAt: new Date(),
            sender: input.name,
        };

        await ctx.db.message.create({
            data: {
                id: message.id,
                createdAt: message.createdAt,
                roomId: message.roomId,
                sender: message.sender,
                message: message.message,
            }
        });

        ctx.ee.emit("SEND_MESSAGE", message);
        return message;
    }),

    onSendMessage: protectedProcedure.input(
        z.object({
            roomId: z.string(),
            name: z.string().optional()
        })
    )
    .subscription(async function* ({ ctx, input, signal }) {
        try {
            await ctx.db.participant.create({
                data: {
                    name: input.name ?? 'Anon',
                    roomId: input.roomId,
                }
            });

            const sysJoinMsg: Message = {
                id: crypto.randomUUID(),
                roomId: input.roomId,
                message: `${input.name ?? 'Someone'} has joined the chat.`,
                createdAt: new Date(),
                sender: 'SYSTEM',
            };

            await ctx.db.message.create({ data: sysJoinMsg });
            ctx.ee.emit("SEND_MESSAGE", sysJoinMsg);

            yield sysJoinMsg;

            for await (const [data] of on(ctx.ee, "SEND_MESSAGE", { signal })) {
                const message = data as Message;
                if (message.roomId === input.roomId) {
                    yield message;
                }
            }
        } finally {
            const sysDcMsg: Message = {
                id: crypto.randomUUID(),
                roomId: input.roomId,
                message: `${input.name ?? "A user"} has left the chat.`,
                createdAt: new Date(),
                sender: 'SYSTEM',
            };

            await ctx.db.message.create({
                data: {
                    id: sysDcMsg.id,
                    createdAt: sysDcMsg.createdAt,
                    roomId: sysDcMsg.roomId,
                    sender: sysDcMsg.sender,
                    message: sysDcMsg.message,
                }
            });

            ctx.ee.emit("SEND_MESSAGE", sysDcMsg);

            await ctx.db.participant.delete({
                where: { roomId: input.roomId, id: ctx.session.user.id}
            })
        }
    }),

    checkRoomExists: publicProcedure
        .input(
            z.object({
                id: z.string().min(1, "RoomId cannot be empty")
            })
        )
        .mutation(async ({ ctx, input }) => {
            const room = await ctx.db.room.findUnique({
                where: { id: input.id },
                select: { id: true },
            });

            return { exists: !!room };
    }),
    
    createRoom: publicProcedure
        .input(
            z.object({
                id: z.string() 
            })
        )
        .mutation(async ({ ctx, input }) => {
            const newRoom = await ctx.db.room.create({
                data: {
                    id: input.id,
                },
            });

            return newRoom;
    }),

    addToRoom: publicProcedure
        .input(
            z.object({
                id: z.string(),
                name: z.string(),
                roomId: z.string(),
            })
        )
        .mutation(async ({ctx, input}) => {
            try {
                const newParticipant = await ctx.db.participant.create({
                    data: {
                        id: input.id,
                        name: input.name,
                        roomId: input.roomId,
                    }
                });

                const updatedRoom = await ctx.db.room.update({
                    where: { id: input.roomId },
                    data: {
                        participants: {
                            connect: { id: newParticipant.id },
                        },
                    },
                    include: {
                        participants: true,
                    }
                });

                return {
                    success: true,
                    participant: newParticipant,
                    room: updatedRoom,
                };
            } catch (error) {
                throw new Error("Failed to add participant to room");
            }
    }),

    exitRoom: protectedProcedure
        .input(
            z.object({
                roomId: z.string(),
                userId: z.string(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // delete participant from room
            // await ctx.db.room.

            ctx.ee.emit(`room-${input.roomId}`, {
                type: 'SYSTEM',
                message: `User ${input.userId} has left the chat.`,
            });
    }),
});
