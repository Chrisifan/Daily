import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import { ToastProvider } from "./shared/ui/ToastProvider";
import "./App.css";

function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}

export default App;
