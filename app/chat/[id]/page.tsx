"use client"
import React, { Suspense } from "react";
import ChatConversationComponent from "../../_pages/ChatConversation";

export default function ChatConversationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0b141a]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-vic-green"></div>
      </div>
    }>
      <ChatConversationComponent />
    </Suspense>
  );
}
