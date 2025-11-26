import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import AddRecurringCharge from './AddRecurringCharge';
import RecurringChargeList from './RecurringChargeList';
import { 
  getRecurringCharges, 
  addRecurringCharge, 
  updateRecurringCharge, 
  deleteRecurringCharge 
} from '../../services/recurringChargesService';
import './RecurringCharges.css';

/**
 * Main component for managing recurring charges
 * Displays a form to add new charges and a list of existing ones
 */
const RecurringCharges = () => {
  const { currentUser } = useAuth();
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCharge, setEditingCharge] = useState(null);

  // Load recurring charges on mount
  useEffect(() => {
    loadCharges();
  }, [currentUser]);

  const loadCharges = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getRecurringCharges(currentUser.uid);
      setCharges(data);
    } catch (err) {
      console.error('Error loading recurring charges:', err);
      setError('Failed to load recurring charges. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCharge = async (chargeData) => {
    try {
      setError(null);
      await addRecurringCharge(currentUser.uid, chargeData);
      await loadCharges(); // Reload the list
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding recurring charge:', err);
      setError('Failed to add recurring charge. Please try again.');
      throw err; // Let the form handle it too
    }
  };

  const handleUpdateCharge = async (chargeId, chargeData) => {
    try {
      setError(null);
      await updateRecurringCharge(currentUser.uid, chargeId, chargeData);
      await loadCharges(); // Reload the list
      setEditingCharge(null);
    } catch (err) {
      console.error('Error updating recurring charge:', err);
      setError('Failed to update recurring charge. Please try again.');
      throw err;
    }
  };

  const handleDeleteCharge = async (chargeId) => {
    if (!window.confirm('Are you sure you want to delete this recurring charge?')) {
      return;
    }

    try {
      setError(null);
      await deleteRecurringCharge(currentUser.uid, chargeId);
      await loadCharges(); // Reload the list
    } catch (err) {
      console.error('Error deleting recurring charge:', err);
      setError('Failed to delete recurring charge. Please try again.');
    }
  };

  const handleEditCharge = (charge) => {
    setEditingCharge(charge);
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingCharge(null);
    setShowAddForm(false);
  };

  return (
    <div className="recurring-charges">
      <div className="recurring-charges-header">
        <h2>Recurring Charges</h2>
        <button 
          className="btn-add-charge"
          onClick={() => setShowAddForm(!showAddForm)}
          aria-label={showAddForm ? 'Close form' : 'Add recurring charge'}
        >
          {showAddForm ? '✕ Cancel' : '+ Add Recurring Charge'}
        </button>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {showAddForm && (
        <AddRecurringCharge
          onAdd={handleAddCharge}
          onUpdate={handleUpdateCharge}
          onCancel={handleCancelEdit}
          editingCharge={editingCharge}
        />
      )}

      {loading ? (
        <div className="loading-state">
          <p>Loading recurring charges...</p>
        </div>
      ) : (
        <RecurringChargeList
          charges={charges}
          onEdit={handleEditCharge}
          onDelete={handleDeleteCharge}
        />
      )}
    </div>
  );
};

export default RecurringCharges;
