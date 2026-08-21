import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ConfigProvider } from "@/context/ConfigContext";
import { ThemeProvider } from "@/context/ThemeContext";
import RouteGuard from "@/components/RouteGuard";
import AppShell from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import Setup from "@/pages/Setup";
import Settings from "@/pages/Settings";
import Install from "@/pages/Install";

function App() {
  return (
    <div className="App grain-overlay">
      <ThemeProvider>
        <ConfigProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/setup" element={<Setup />} />
              <Route path="/install" element={<Install />} />
              <Route
                element={
                  <RouteGuard>
                    <AppShell />
                  </RouteGuard>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors closeButton />
        </ConfigProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
