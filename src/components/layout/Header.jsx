import React, { useState } from 'react';
import './Header.css';

/**
 * Header component for BudgetBliss
 * Contains logo (left), navigation (center), and account button (right)
 * Mobile: Hamburger menu for navigation
 */
const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
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
            {/* Account button in mobile menu */}
            <li className="nav-item mobile-account-item">
              <button className="mobile-account-button" onClick={closeMobileMenu}>
                <span className="account-icon">👤</span>
                <span className="account-text">Account Settings</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* Account Section - Right */}
        <div className="header-account">
          <button className="account-button" aria-label="Account settings">
            <span className="account-icon">👤</span>
            <span className="account-text">Account</span>
          </button>
        </div>

        {/* Hamburger Menu Button - Mobile Only (Right Side) */}
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
