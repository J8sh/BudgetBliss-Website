import { useState } from 'react';
import './App.css';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import { AuthProvider, useAuth } from './context/AuthContext';

// Dashboard component (shown when user is logged in)
function Dashboard() {
  return (
    <main className="App-main">
      <h1>Welcome to BudgetBliss</h1>
      <p>Your daily spending visualization tool</p>
      <p className="dashboard-message">🎉 You're logged in! Dashboard coming soon...</p>
    </main>
  );
}

// Auth wrapper component
function AuthenticatedApp() {
  const { currentUser } = useAuth();
  const [showLogin, setShowLogin] = useState(true);

  // If user is logged in, show the dashboard
  if (currentUser) {
    return (
      <div className="App">
        <Header />
        <Dashboard />
        <Footer />
      </div>
    );
  }

  // If user is not logged in, show login or signup
  return (
    <div className="App">
      <Header />
      {showLogin ? (
        <Login onSwitchToSignup={() => setShowLogin(false)} />
      ) : (
        <Signup onSwitchToLogin={() => setShowLogin(true)} />
      )}
      <Footer />
    </div>
  );
}

// Main App component
function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
