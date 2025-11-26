import React from 'react';
import './Footer.css';

/**
 * Footer component for BudgetBliss
 * Simple footer with copyright and links
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <p className="footer-text">
          © {currentYear} BudgetBliss. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
