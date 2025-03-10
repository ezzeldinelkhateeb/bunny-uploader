import { Suspense } from "react";
import { useRoutes, Routes, Route } from "react-router-dom";
import Home from "./components/home";
import NotFound from "./components/NotFound";
import routes from "tempo-routes";
import { TestSheetsConnection } from "./components/TestSheetsConnection";
import { ToastProvider } from "./components/providers/toast-provider";
import { Toaster } from "./components/ui/toaster";

function App() {
  return (
    <ToastProvider>
      <Suspense fallback={<p>Loading...</p>}>
        <div className="min-h-screen bg-background">
          <TestSheetsConnection />
          {/* Tempo routes first */}
          {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}

          <Routes>
            <Route path="/" element={<Home />} />
            {import.meta.env.VITE_TEMPO === "true" && (
              <Route path="/tempobook/*" />
            )}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </div>
      </Suspense>
    </ToastProvider>
  );
}

export default App;
