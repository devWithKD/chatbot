"use client";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@ai-sdk/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SendHorizontal, X, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    initialMessages: [],
  });
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [hasLanguagePreference, setHasLanguagePreference] =
    useState<boolean>(false);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Check if language preference has been established
  useEffect(() => {
    const conversationText = messages
      .map((m) => m.content)
      .join(" ")
      .toLowerCase();
    const hasLanguage =
      conversationText.includes("english") ||
      conversationText.includes("marathi") ||
      conversationText.includes("hindi") ||
      conversationText.includes("मराठी") ||
      conversationText.includes("हिंदी") ||
      conversationText.includes("इंग्रजी");
    setHasLanguagePreference(hasLanguage);
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > 0 && status === "streaming") {
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role !== "user") {
        const intervalId = setInterval(scrollToBottom, 100);
        return () => clearInterval(intervalId);
      }
    }
  }, [messages.length, status]);

  // Enhanced language selection with better UX
  const LanguageSelector = () => (
    <div className="flex flex-col gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertCircle size={18} className="text-blue-600" />
        <p className="text-sm font-semibold text-blue-800">
          भाषा निवडा / Choose Language / भाषा चुनें
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            handleInputChange({
              target: { value: "English" },
            } as React.ChangeEvent<HTMLInputElement>);
            setTimeout(() => handleSubmit(), 100);
          }}
          className="text-xs font-medium hover:bg-blue-100 border-blue-300 transition-colors"
        >
          English
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            handleInputChange({
              target: { value: "मराठी" },
            } as React.ChangeEvent<HTMLInputElement>);
            setTimeout(() => handleSubmit(), 100);
          }}
          className="text-xs font-medium hover:bg-orange-100 border-orange-300 transition-colors"
        >
          मराठी
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            handleInputChange({
              target: { value: "हिंदी" },
            } as React.ChangeEvent<HTMLInputElement>);
            setTimeout(() => handleSubmit(), 100);
          }}
          className="text-xs font-medium hover:bg-green-100 border-green-300 transition-colors"
        >
          हिंदी
        </Button>
      </div>
    </div>
  );

  // Enhanced KMC service suggestions with icons
  const ServiceSuggestions = () => (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-green-700 px-1">Quick Services:</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleInputChange({
              target: { value: "Property tax payment information" },
            } as React.ChangeEvent<HTMLInputElement>);
            setTimeout(() => handleSubmit(), 100);
          }}
          className="text-xs h-auto p-3 text-left justify-start bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
        >
          <div className="flex flex-col items-start">
            <span className="font-medium">Property Tax</span>
            <span className="text-xs text-green-600">
              Payment & Information
            </span>
          </div>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleInputChange({
              target: { value: "Water bill payment" },
            } as React.ChangeEvent<HTMLInputElement>);
            setTimeout(() => handleSubmit(), 100);
          }}
          className="text-xs h-auto p-3 text-left justify-start bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
        >
          <div className="flex flex-col items-start">
            <span className="font-medium">Water Bills</span>
            <span className="text-xs text-blue-600">Payment & Status</span>
          </div>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleInputChange({
              target: { value: "Birth certificate application" },
            } as React.ChangeEvent<HTMLInputElement>);
            setTimeout(() => handleSubmit(), 100);
          }}
          className="text-xs h-auto p-3 text-left justify-start bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 transition-colors"
        >
          <div className="flex flex-col items-start">
            <span className="font-medium">Birth Certificate</span>
            <span className="text-xs text-yellow-600">Apply Online</span>
          </div>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleInputChange({
              target: { value: "Business license information" },
            } as React.ChangeEvent<HTMLInputElement>);
            setTimeout(() => handleSubmit(), 100);
          }}
          className="text-xs h-auto p-3 text-left justify-start bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
        >
          <div className="flex flex-col items-start">
            <span className="font-medium">Business License</span>
            <span className="text-xs text-purple-600">Apply & Renew</span>
          </div>
        </Button>
      </div>
    </div>
  );

  // Enhanced welcome message
  const WelcomeMessage = () => (
    <div className="text-sm text-zinc-700 mb-4 p-4 bg-gradient-to-br from-white to-gray-50 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <p className="font-semibold text-gray-800">Welcome to KMC Assistant</p>
      </div>
      <p className="mb-3 text-gray-600">
        I can help you with Kolhapur Municipal Corporation services in{" "}
        <span className="font-medium">English, मराठी, or हिंदी</span>:
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>Property Tax & Payments</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          <span>Water Supply & Bills</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
          <span>Certificates (Birth/Death)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
          <span>Business Licenses</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          <span>Health & Sanitation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
          <span>Municipal Services</span>
        </div>
      </div>
    </div>
  );

  // Loading indicator
  const LoadingIndicator = () => (
    <div className="flex items-center gap-2 text-xs text-gray-500 p-2">
      <div className="animate-spin w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full"></div>
      <span>KMC Assistant is typing...</span>
    </div>
  );

  return (
    <main className="w-full h-full flex justify-center items-center relative bg-gradient-to-br from-zinc-100 to-zinc-300">
      <div className="text-center">
        <span className="text-3xl font-bold text-zinc-800 block">
          Kolhapur Municipal Corporation
        </span>
        <p className="text-sm text-zinc-600 mt-2">
          कोल्हापूर महानगरपालिका • Smart City Initiative
        </p>
      </div>

      <div className="absolute bottom-5 right-5 max-w-sm w-full">
        <Popover open={open} onOpenChange={(open) => setOpen(open)}>
          <PopoverTrigger className="w-full bg-white hover:bg-gray-50 rounded-xl border border-gray-300 py-2 px-3 shadow-lg transition-all duration-200 cursor-pointer text-center font-medium hover:shadow-xl">
            <div className="flex items-center justify-center gap-3">
              <span>Chat with KMC Assistant</span>
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className="w-[420px] bg-white border border-gray-300 rounded-xl my-2 p-0 flex flex-col shadow-2xl"
            sideOffset={8}
          >
            {/* Header */}
            <div className="w-full flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-semibold text-gray-800">
                    KMC AI Assistant
                  </span>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full w-8 h-8 hover:bg-gray-200"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>

            {/* Chat Area */}
            <ScrollArea className="h-[300px] p-4 bg-gray-50">
              {/* Welcome message for new users */}
              {messages.length === 0 && <WelcomeMessage />}

              {/* Messages */}
              {messages.map((m) => (
                <div key={m.id} className="mb-4">
                  {m.role === "user" && (
                    <div className="w-full flex justify-end">
                      <div className="rounded-2xl rounded-tr-md p-3 border border-blue-200 w-fit max-w-[280px] bg-blue-600 text-white shadow-sm">
                        <p className="text-sm">{m.content}</p>
                      </div>
                    </div>
                  )}
                  {m.role !== "user" && (
                    <div className="w-full flex justify-start">
                      <div className="rounded-2xl rounded-tl-md p-3 border border-gray-200 w-fit max-w-[320px] bg-white shadow-sm">
                        <MemoizedMarkdown id={m.id} content={m.content} />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Show language selector if no preference established */}
              {messages.length > 0 && !hasLanguagePreference && (
                <div className="mb-4">
                  <LanguageSelector />
                </div>
              )}

              {/* Loading indicator */}
              {status === "streaming" && <LoadingIndicator />}

              <div ref={messageEndRef} />
            </ScrollArea>

            {/* Quick suggestions for new users */}
            {messages.length === 0 && (
              <div className="p-4 border-t border-gray-200">
                <ServiceSuggestions />
              </div>
            )}

            {/* Input form */}
            <div className="p-2 border-t border-gray-200 bg-white rounded-b-xl">
              <form
                onSubmit={handleSubmit}
                className="w-full bg-gray-50 border border-gray-200 rounded-full flex items-center gap-2 px-4 py-2 focus-within:border-blue-400 focus-within:bg-white transition-colors"
              >
                <input
                  className="flex-1 bg-transparent focus:outline-none text-sm placeholder:text-gray-500"
                  value={input}
                  placeholder={
                    !hasLanguagePreference && messages.length > 0
                      ? "Please select language first..."
                      : "Ask about KMC services..."
                  }
                  onChange={handleInputChange}
                  disabled={!hasLanguagePreference && messages.length > 0}
                />
                <Button
                  variant="ghost"
                  type="submit"
                  size="icon"
                  className="w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                  disabled={
                    status === "streaming" ||
                    (!hasLanguagePreference && messages.length > 0) ||
                    !input.trim()
                  }
                >
                  <SendHorizontal size={14} />
                </Button>
              </form>

              {/* Footer info */}
              {/* <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>KMC Official Assistant</span>
                <div className="flex items-center gap-1">
                  <ExternalLink size={10} />
                  <span>Powered by AI</span>
                </div>
              </div> */}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </main>
  );
}
