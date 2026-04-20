import { RouterProvider } from "react-router-dom";

import { AppProviders } from "./app/providers/app-providers";
import { router } from "./routes/router";

export const App = () => {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
};
