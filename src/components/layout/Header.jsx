import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

/**
 * Header component for BudgetBliss
 * Contains logo (left), navigation (center), and account button (right)
 * Mobile: Hamburger menu for navigation
 */
const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const { currentUser, logout } = useAuth();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const toggleAccountMenu = () => {
    setShowAccountMenu(!showAccountMenu);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setShowAccountMenu(false);
      closeMobileMenu();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo Section - Left */}
        <div className="header-logo">
          <img 
            src="/assets/logo.svg" 
            alt="BudgetBliss Logo" 
            className="logo-image"
          />
          <span className="logo-text">BudgetBliss</span>
        </div>

        {/* Navigation Section - Center */}
        <nav 
          className={`header-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}
          aria-label="Main navigation"
        >
          {currentUser && (
            <ul className="nav-list">
              <li className="nav-item">
                <a href="/" className="nav-link active" onClick={closeMobileMenu}>
                  Dashboard
                </a>
              </li>
              <li className="nav-item">
                <a href="/transactions" className="nav-link" onClick={closeMobileMenu}>
                  Transactions
                </a>
              </li>
              <li className="nav-item">
                <a href="/analytics" className="nav-link" onClick={closeMobileMenu}>
                  Analytics
                </a>
              </li>
              <li className="nav-item">
                <a href="/budgets" className="nav-link" onClick={closeMobileMenu}>
                  Budgets
                </a>
              </li>
              {/* Logout button in mobile menu */}
              <li className="nav-item mobile-account-item">
                <button className="mobile-account-button" onClick={handleLogout}>
                  <span className="account-icon">�</span>
                  <span className="account-text">Logout</span>
                </button>
              </li>
            </ul>
          )}
        </nav>

        {/* Account Section - Right */}
        {currentUser && (
          <div className="header-account">
            <button 
              className="account-button" 
              aria-label="Account settings"
              onClick={toggleAccountMenu}
            >
              <span className="account-icon">👤</span>
              <span className="account-text">{currentUser.email}</span>
            </button>
            
            {/* Account Dropdown Menu */}
            {showAccountMenu && (
              <div className="account-menu">
                <div className="account-menu-header">
                  <p className="account-email">{currentUser.email}</p>
                </div>
                <button 
                  className="account-menu-item logout-button"
                  onClick={handleLogout}
                >
                  <span className="menu-icon">🚪</span>
                  Logout
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hamburger Menu Button - Mobile Only (Right Side) */}
        {currentUser && (
          <button 
            className={`hamburger-button ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-overlay" 
          onClick={closeMobileMenu}
          aria-hidden="true"
        ></div>
      )}
    </header>
  );
};

export default Header;
