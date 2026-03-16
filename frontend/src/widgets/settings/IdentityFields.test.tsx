import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render";
import { IdentityFields } from "./IdentityFields";

describe("IdentityFields", () => {
  it("renders the username field when username props are provided", async () => {
    const user = userEvent.setup();
    const onChangeUsername = vi.fn();

    renderWithProviders(
      <IdentityFields
        username="dev-user"
        onChangeUsername={onChangeUsername}
        name="Dev"
        onChangeName={() => {}}
        surname="User"
        onChangeSurname={() => {}}
        email="dev@example.com"
        onChangeEmail={() => {}}
        errorUsername="A user with that username already exists."
      />
    );

    const usernameInput = screen.getByPlaceholderText("Username");
    expect(usernameInput).toHaveValue("dev-user");
    expect(screen.getByText("A user with that username already exists.")).toBeInTheDocument();

    await user.type(usernameInput, "2");

    expect(onChangeUsername).toHaveBeenCalled();
  });

  it("normalizes username input to lowercase while typing", async () => {
    const user = userEvent.setup();
    const onChangeUsername = vi.fn();

    renderWithProviders(
      <IdentityFields
        username="dev-user"
        onChangeUsername={onChangeUsername}
        name="Dev"
        onChangeName={() => {}}
        surname="User"
        onChangeSurname={() => {}}
        email="dev@example.com"
        onChangeEmail={() => {}}
      />
    );

    await user.type(screen.getByPlaceholderText("Username"), "ABC");

    expect(onChangeUsername).toHaveBeenLastCalledWith("dev-userabc");
  });

  it("keeps the add-user form layout unchanged when username props are omitted", () => {
    renderWithProviders(
      <IdentityFields
        name="Dev"
        onChangeName={() => {}}
        surname="User"
        onChangeSurname={() => {}}
        email="dev@example.com"
        onChangeEmail={() => {}}
      />
    );

    expect(screen.queryByPlaceholderText("Username")).not.toBeInTheDocument();
  });
});
