import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@phinduloans/shared/components/common/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@phinduloans/shared/components/ui/toaster";
import { Toaster as Sonner } from "@phinduloans/shared/components/ui/sonner";
import { TooltipProvider } from "@phinduloans/shared/components/ui/tooltip";
import { AuthProvider } from "@phinduloans/shared/hooks/useAuth";
import { ThemeProvider } from "@phinduloans/shared/theme/ThemeProvider";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Apply from "./pages/Apply";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                  <Route path="/login" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                  <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                  <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
                  <Route path="/apply" element={<ErrorBoundary><Apply /></ErrorBoundary>} />
                  <Route path="/pre-qualify" element={<ErrorBoundary><Apply /></ErrorBoundary>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
