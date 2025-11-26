import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './RecurringChargeList.css';

/**
 * Component to display a list of recurring charges
 * 
 * @param {Array} charges - Array of recurring charge objects
 * @param {Function} onEdit - Callback when editing a charge
 * @param {Function} onDelete - Callback when deleting a charge
 */
const RecurringChargeList = ({ charges, onEdit, onDelete }) => {
  const [expandedChargeId, setExpandedChargeId] = useState(null);

  const toggleExpand = (chargeId) => {
    setExpandedChargeId(expandedChargeId === chargeId ? null : chargeId);
  };
  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Helper function to format frequency for display
  const formatFrequency = (frequency) => {
    const frequencyMap = {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      semiannually: 'Semi-annually',
      yearly: 'Yearly'
    };
    return frequencyMap[frequency] || frequency;
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Helper function to get category icon
  const getCategoryIcon = (category) => {
    const iconMap = {
      utilities: '⚡',
      subscriptions: '📺',
      insurance: '🛡️',
      rent: '🏠',
      loan: '💳',
      memberships: '🎯',
      services: '🔧',
      other: '📌'
    };
    return iconMap[category] || '📌';
  };

  // Calculate monthly equivalent for budgeting
  const getMonthlyEquivalent = (amount, frequency) => {
    const multipliers = {
      daily: 30,
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 0.33,
      semiannually: 0.167,
      yearly: 0.083
    };
    return amount * (multipliers[frequency] || 1);
  };

  // Calculate total monthly cost
  const getTotalMonthlyCost = () => {
    return charges
      .filter(charge => charge.isActive)
      .reduce((total, charge) => {
        return total + getMonthlyEquivalent(charge.amount, charge.frequency);
      }, 0);
  };

  if (charges.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <h3>No Recurring Charges Yet</h3>
        <p>Start by adding your first recurring charge using the button above.</p>
      </div>
    );
  }

  return (
    <div className="recurring-charge-list">
      {/* Summary Card */}
      <div className="summary-card">
        <div className="summary-item">
          <span className="summary-label">Total Active Charges</span>
          <span className="summary-value">
            {charges.filter(c => c.isActive).length}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Monthly Equivalent</span>
          <span className="summary-value highlight">
            {formatCurrency(getTotalMonthlyCost())}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Yearly Equivalent</span>
          <span className="summary-value">
            {formatCurrency(getTotalMonthlyCost() * 12)}
          </span>
        </div>
      </div>

      {/* Charges List - Slim View */}
      <div className="charges-slim-list">
        {charges.map(charge => {
          const isExpanded = expandedChargeId === charge.id;
          
          return (
            <div 
              key={charge.id} 
              className={`charge-item-slim ${!charge.isActive ? 'inactive' : ''} ${isExpanded ? 'expanded' : ''}`}
            >
              {/* Collapsed View - Name and Amount */}
              <div 
                className="charge-item-header"
                onClick={() => toggleExpand(charge.id)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    toggleExpand(charge.id);
                  }
                }}
                aria-expanded={isExpanded}
              >
                <div className="charge-item-main">
                  <span className="charge-item-icon">{getCategoryIcon(charge.category)}</span>
                  <span className="charge-item-name">{charge.name}</span>
                  {!charge.isActive && (
                    <span className="status-badge-slim inactive-badge">Paused</span>
                  )}
                </div>
                <div className="charge-item-amount-wrapper">
                  <span className="charge-item-amount">{formatCurrency(charge.amount)}</span>
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                </div>
              </div>

              {/* Expanded View - All Details */}
              {isExpanded && (
                <div className="charge-item-details">
                  <div className="detail-row">
                    <span className="detail-label">Frequency:</span>
                    <span className="detail-value">{formatFrequency(charge.frequency)}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="detail-label">Category:</span>
                    <span className="detail-value">
                      {charge.category.charAt(0).toUpperCase() + charge.category.slice(1)}
                    </span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="detail-label">Start Date:</span>
                    <span className="detail-value">{formatDate(charge.startDate)}</span>
                  </div>
                  
                  {charge.endDate && (
                    <div className="detail-row">
                      <span className="detail-label">End Date:</span>
                      <span className="detail-value">{formatDate(charge.endDate)}</span>
                    </div>
                  )}
                  
                  {charge.isActive && (
                    <div className="detail-row highlight-row">
                      <span className="detail-label">Monthly Equivalent:</span>
                      <span className="detail-value">
                        {formatCurrency(getMonthlyEquivalent(charge.amount, charge.frequency))}
                      </span>
                    </div>
                  )}
                  
                  {charge.notes && (
                    <div className="detail-row notes-row">
                      <span className="detail-label">Notes:</span>
                      <span className="detail-value">{charge.notes}</span>
                    </div>
                  )}
                  
                  <div className="charge-item-actions">
                    <button
                      className="btn-edit-slim"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(charge);
                      }}
                      aria-label={`Edit ${charge.name}`}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn-delete-slim"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(charge.id);
                      }}
                      aria-label={`Delete ${charge.name}`}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

RecurringChargeList.propTypes = {
  charges: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      amount: PropTypes.number.isRequired,
      frequency: PropTypes.string.isRequired,
      category: PropTypes.string.isRequired,
      startDate: PropTypes.string.isRequired,
      endDate: PropTypes.string,
      isActive: PropTypes.bool,
      notes: PropTypes.string
    })
  ).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired
};

export default RecurringChargeList;
