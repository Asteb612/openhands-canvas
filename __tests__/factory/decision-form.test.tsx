import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FactoryDecisionFormView } from "#/factory/decision-form";

const review = {
  what: "la suite du run",
  files: [],
  instructions: "La boucle n'a pas convergé en 6 passages.",
  outcomes: [
    {
      id: "more",
      label: "Un passage de plus",
      kind: "other" as const,
      requireComment: false,
    },
    {
      id: "changes",
      label: "Demander des changements",
      kind: "changes" as const,
      requireComment: true,
    },
  ],
};

describe("FactoryDecisionFormView", () => {
  it("sends the picked choice with the comment", async () => {
    const onSend = vi.fn();
    render(
      <FactoryDecisionFormView
        review={review}
        sending={false}
        sent={null}
        onSend={onSend}
      />,
    );
    expect(screen.getByTestId("factory-decision-form")).toHaveTextContent(
      "6 passages",
    );
    await userEvent.type(
      screen.getByTestId("factory-decision-comment"),
      "seulement les 2 points",
    );
    await userEvent.click(screen.getByTestId("factory-decision-option-more"));
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ id: "more" }),
      "seulement les 2 points",
    );
  });

  it("asks for the comment a choice requires before sending", async () => {
    const onSend = vi.fn();
    render(
      <FactoryDecisionFormView
        review={review}
        sending={false}
        sent={null}
        onSend={onSend}
      />,
    );
    await userEvent.click(
      screen.getByTestId("factory-decision-option-changes"),
    );
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByTestId("factory-decision-comment")).toHaveFocus();
  });

  it("shows the sent state", () => {
    render(
      <FactoryDecisionFormView
        review={review}
        sending={false}
        sent="Un passage de plus"
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByTestId("factory-decision-form-sent")).toHaveTextContent(
      "Un passage de plus",
    );
  });
});
