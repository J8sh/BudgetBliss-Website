import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './AddRecurringCharge.css';

/**
 * Form component for adding or editing recurring charges
 * 
 * @param {Function} onAdd - Callback when adding a new charge
 * @param {Function} onUpdate - Callback when updating an existing charge
 * @param {Function} onCancel - Callback when canceling edit mode
 * @param {Object} editingCharge - Charge being edited (null if adding new)
 */
const AddRecurringCharge = ({ onAdd, onUpdate, onCancel, editingCharge }) => {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly',
    category: 'utilities',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isActive: true,
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (editingCharge) {
      setFormData({
        name: editingCharge.name || '',
        amount: editingCharge.amount || '',
        frequency: editingCharge.frequency || 'monthly',
        category: editingCharge.category || 'utilities',
        startDate: editingCharge.startDate || new Date().toISOString().split('T')[0],
        endDate: editingCharge.endDate || '',
        isActive: editingCharge.isActive ?? true,
        notes: editingCharge.notes || ''
      });
    }
  }, [editingCharge]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setFormError(''); // Clear error when user types
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setFormError('Please enter a name for the recurring charge');
      return false;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setFormError('Please enter a valid amount greater than 0');
      return false;
    }

    if (!formData.startDate) {
      setFormError('Please select a start date');
      return false;
    }

    if (formData.endDate && formData.endDate < formData.startDate) {
      setFormError('End date cannot be before start date');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const chargeData = {
        ...formData,
        amount: parseFloat(formData.amount),
        updatedAt: new Date().toISOString()
      };

      if (editingCharge) {
        await onUpdate(editingCharge.id, chargeData);
      } else {
        await onAdd(chargeData);
      }

      // Reset form on success
      setFormData({
        name: '',
        amount: '',
        frequency: 'monthly',
        category: 'utilities',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        isActive: true,
        notes: ''
      });
    } catch (err) {
      setFormError('Failed to save recurring charge. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-recurring-charge">
      <h3>{editingCharge ? 'Edit Recurring Charge' : 'Add New Recurring Charge'}</h3>
      
      {formError && (
        <div className="form-error" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="recurring-charge-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">
              Charge Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Netflix Subscription"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="amount">
              Amount ($) <span className="required">*</span>
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              disabled={isSubmitting}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="frequency">
              Frequency <span className="required">*</span>
            </label>
            <select
              id="frequency"
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly (3 months)</option>
              <option value="semiannually">Semi-annually (6 months)</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="category">
              Category <span className="required">*</span>
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            >
              <option value="utilities">Utilities</option>
              <option value="subscriptions">Subscriptions</option>
              <option value="insurance">Insurance</option>
              <option value="rent">Rent/Mortgage</option>
              <option value="loan">Loan Payment</option>
              <option value="memberships">Memberships</option>
              <option value="services">Services</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startDate">
              Start Date <span className="required">*</span>
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="endDate">
              End Date (Optional)
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="notes">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Additional details about this recurring charge..."
            rows="3"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group checkbox-group">
          <label htmlFor="isActive" className="checkbox-label">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <span>Active (uncheck to pause this charge)</span>
          </label>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : editingCharge ? 'Update Charge' : 'Add Charge'}
          </button>
          {editingCharge && (
            <button
              type="button"
              className="btn-cancel"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

AddRecurringCharge.propTypes = {
  onAdd: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  editingCharge: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    amount: PropTypes.number,
    frequency: PropTypes.string,
    category: PropTypes.string,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    isActive: PropTypes.bool,
    notes: PropTypes.string
  })
};

export default AddRecurringCharge;
