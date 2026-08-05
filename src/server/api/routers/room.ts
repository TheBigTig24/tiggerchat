import { z } from "zod";
import { on } from "events";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import crypto from "crypto";

type Message = {
    id: string;
    roomId: string;
    message: string;
    sentAt: Date;
    sender: {
        name: string;
    };
};

export const roomRouter = createTRPCRouter({
    sendMessage: protectedProcedure.input(
        z.object({
            roomId: z.string(),
            message: z.string(),
            name: z.string(),
        })
    )
    .mutation(({ ctx, input }) => {
        const message: Message = {
            id: crypto.randomUUID(),
            roomId: input.roomId,
            message: input.message,
            sentAt: new Date(),
            sender: {
                name: input.name,
            },
        };

        ctx.ee.emit("SEND_MESSAGE", message);
        return message;
    }),

    onSendMessage: protectedProcedure.input(
        z.object({
            roomId: z.string(),
        })
    )
    .subscription(async function* ({ ctx, input, signal }) {
        for await (const [data] of on(ctx.ee, "SEND_MESSAGE", { signal })) {
            const message = data as Message;
            if (message.roomId === input.roomId) {
                yield message;
            }
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
});
