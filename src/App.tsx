import { Suspense } from "react";
import { useRoutes, Routes, Route } from "react-router-dom";
import Home from "./components/home";
import NotFound from "./components/NotFound";
import routes from "tempo-routes";
import { TestSheetsConnection } from "./components/TestSheetsConnection";

function App() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <div>
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
      </div>
    </Suspense>
  );
}

export default App;
