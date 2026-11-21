import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useHandleBuildPlanClick } from "#/hooks/use-handle-build-plan-click";
import { useConversationStore } from "#/stores/conversation-store";
import { useOptimisticUserMessageStore } from "#/stores/optimistic-user-message-store";

// factory: Build is disabled in the fork. The orchestrator drives the steps;
// neither the button, the plan preview nor Ctrl/Cmd+Enter may tell the agent
// to execute PLAN.md. (Upstream's tests asserted the opposite.)

vi.mock("#/hooks/use-send-message", () => ({ useSendMessage: vi.fn() }));
vi.mock("#/hooks/use-conversation-id", () => ({
  useOptionalConversationId: () => ({ conversationId: "test-conversation-id" }),
  useConversationId: () => ({ conversationId: "test-conversation-id" }),
}));

import { useSendMessage } from "#/hooks/use-send-message";

describe("useHandleBuildPlanClick (factory: disabled)", () => {
  const mockSend = vi.fn().mockResolvedValue({ queued: false });

  beforeEach(() => {
    vi.clearAllMocks();
    useConversationStore.setState({ conversationMode: "plan" });
    useOptimisticUserMessageStore.getState().clearPendingMessages();
    (useSendMessage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      send: mockSend,
    });
  });

  it("sends nothing and keeps the mode, from a click or a key press", () => {
    const { result } = renderHook(() => useHandleBuildPlanClick());
    const keyEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      ctrlKey: true,
    });
    const preventDefault = vi.spyOn(keyEvent, "preventDefault");

    act(() => {
      result.current.handleBuildPlanClick();
      result.current.handleBuildPlanClick(keyEvent);
    });

    expect(mockSend).not.toHaveBeenCalled();
    expect(useConversationStore.getState().conversationMode).toBe("plan");
    expect(
      useOptimisticUserMessageStore.getState().pendingMessages ?? [],
    ).toHaveLength(0);
    // The shortcut is still swallowed so it does nothing else either.
    expect(preventDefault).toHaveBeenCalled();
  });
});
