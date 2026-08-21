"use client";

import { MessageSquare, Phone } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConversationPanel } from "./ConversationPanel";
import { CallRoom } from "@/components/call/CallRoom";

interface Message {
  id: string;
  sender_role: string;
  text: string;
  turn_type: string;
  created_at: string;
}

interface OpenQuestion {
  id: string;
  question_text: string;
  domain: string | null;
  severity: string;
}

// Conversation (typed) and Call (live) used to be two separate sidebar
// items — both are really just "talk to Renovagent," and having them as
// two unrelated-looking nav entries read as confusing duplication rather
// than two real destinations. One page, one mode switch.
export function TalkTabs({
  projectId,
  selfId,
  messages,
  openQuestions,
  activeCallSessionId,
}: {
  projectId: string;
  selfId: string;
  messages: Message[];
  openQuestions: OpenQuestion[];
  activeCallSessionId: string | null;
}) {
  return (
    <Tabs defaultValue="message" className="gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Talk to Renovagent</h1>
        <p className="text-sm text-muted-foreground">Type it out, or call — whichever&apos;s easier right now.</p>
      </div>
      <TabsList variant="line">
        <TabsTrigger value="message" className="gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Message
        </TabsTrigger>
        <TabsTrigger value="call" className="gap-1.5">
          <Phone className="h-3.5 w-3.5" />
          Call
        </TabsTrigger>
      </TabsList>

      <TabsContent value="message">
        <ConversationPanel projectId={projectId} initialMessages={messages} openQuestions={openQuestions} />
      </TabsContent>

      <TabsContent value="call">
        <CallRoom
          projectId={projectId}
          selfId={selfId}
          currentRole="homeowner"
          initialActiveCallSessionId={activeCallSessionId}
          initialMessages={messages}
        />
      </TabsContent>
    </Tabs>
  );
}
