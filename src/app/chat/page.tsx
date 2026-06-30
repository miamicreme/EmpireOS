import { ChatConsole } from '@/components/ui/chat/ChatConsole';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <main className="flex-1 p-4 sm:p-6 overflow-hidden">
      <ChatConsole />
    </main>
  );
}
