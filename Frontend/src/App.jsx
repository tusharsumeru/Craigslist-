import Header from "./components/Header";
import Create from "./pages/Create";
import Generate from "./pages/Generate";
import Send from "./pages/send";
import "./App.css";
import { Toaster } from "react-hot-toast";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

function AppContent() {
  const location = useLocation();
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <Toaster 
        position="top-center" 
        reverseOrder={false} 
        toastOptions={{
          duration: 5000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
      <Header currentPath={location.pathname} />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Create />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/send" element={<Send />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;