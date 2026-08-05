"use client";

import React, { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";

type Message = {
    id: string;
    message: string;
    roomId: string;
    sentAt: Date;
    sender: {
        name: string;
    };
};

export default function RoomPage() {
    // get roomId from URL using app router hook
    const params = useParams();
    const roomId = params.roomId as string;

    // get user's session
    const { data: session, status }  = useSession();

    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);

    // setup tRPC mutation (sending msg)
    const sendMessage = api.room.sendMessage.useMutation();

    // setup tRPC subscription (recv msg)
    api.room.onSendMessage.useSubscription(
        { roomId },
        {
            onData(newMsg) {
                setMessages((prev) => [...prev, newMsg]);
            },
            onError(err) {
                console.error("Subscription error: " , err);
            },
        }
    );

    // show loading state while next auth checks the session
    if (status === "loading") {
        return <main className="flex h-screen bg-gray-900 text-white p-4"> Loading...</main>;
    }

    // force user to log in if they don't have a session
    if (!session) {
        return (
            <main className="flex h-screen items-center justify-center bg-gray-900">
                <button
                    onClick={() => signIn()}
                    className="rounded bg-white px-4 py-2 text-black hover:bg-gray-200"
                >
                    Login to PictoChat
                </button>
            </main>
        )
    }

    // handle form submission
    const onSubmit = (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        sendMessage.mutate({ 
            roomId,
            message,
            name: session?.user?.name ?? "Anonymous"
        });
        setMessage(""); // clear input box
    };

    return (
        <main className="flex h-screen flex-col bg-gray-900">
            {/* Messages List Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {messages.map((m) => {
                    // check if this user sent the emssage to align it
                    const isMe = m.sender.name === session.user?.name;

                    return(
                        <div
                            key={m.id}
                            className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                            <span className="text-xs text-gray-400 mb-1">
                                {m.sender.name} - {m.sentAt.toLocaleTimeString()}
                            </span>
                            <div
                                className={`rounded-md px-4 py-2 text-white w-7/12 ${isMe ? "bg-blue-600 border border-blue-600" : "bg-gray-700 border border-gray-600"}`}
                            >
                                {m.message}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Message Input Form */}
            <form onSubmit={onSubmit} className="flex border-t border-gray-700 bg-gray-800 p-4">
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Send a message..."
                    className="flex-1 rounded-md bg-gray-700 p-2 text-white border border-gray-600 focus:outline-none"
                    rows={1}
                />
                <button
                    type="submit"
                    className="ml-4 rounded-md bg-white px-6 py-2 text-black hover:bg-gray-200"
                >
                    Send
                </button>
            </form>
        </main>
    );
}