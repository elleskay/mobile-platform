import { render, screen, fireEvent } from "@testing-library/react-native";
// Component (ui) layer on jest-expo + React Native Testing Library. Imports the
// real screen from the app (path alias @/ -> app root). In this overlay the
// screen lives in the cloned app; copy this test in alongside it.
import CheckScreen from "@/app/index";

test("[EX-CHECK-003] check button is disabled until a message is entered", () => {
  render(<CheckScreen />);

  const button = screen.getByTestId("check-button");
  expect(button).toBeDisabled();

  fireEvent.changeText(screen.getByTestId("message-input"), "suspicious text");
  expect(button).toBeEnabled();
});
