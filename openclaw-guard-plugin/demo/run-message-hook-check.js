#!/usr/bin/env node

import plugin from "../index.js";

const handlers = {};

plugin.register({
  on(name, handler) {
    handlers[name] = handler;
  },
});

if (typeof handlers.message_sending !== "function") {
  console.error("message_sending hook is not registered");
  process.exit(1);
}

const result = await handlers.message_sending(
  {
    to: "@tessera-demo",
    content: "message.send demo probe",
    metadata: {
      channelId: "telegram",
    },
  },
  {
    agentId: "main",
    channelId: "telegram",
    conversationId: "conversation-main",
    sessionKey: "agent:main:main",
    sessionId: "session-main",
    runId: "demo-message-send",
  },
);

if (result?.cancel) {
  console.log(result.content);
  process.exit(0);
}

console.log("Tessera Guard allowed message.send at the hook boundary.");
