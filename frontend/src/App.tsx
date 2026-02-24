import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginScreen } from "./features/auth/LoginScreen";
import { RetrieveStep1Screen } from "./features/auth/RetrieveStep1Screen";
import { RetrieveStep2Screen } from "./features/auth/RetrieveStep2Screen";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/forgot-password" element={<RetrieveStep1Screen />} />
        <Route path="/forgot-password/verify" element={<RetrieveStep2Screen />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
