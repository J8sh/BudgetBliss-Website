import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Service for managing recurring charges in Firestore
 * All operations are scoped to a specific user
 */

const COLLECTION_NAME = 'recurringCharges';

/**
 * Get all recurring charges for a user
 * 
 * @param {string} userId - The user's UID
 * @returns {Promise<Array>} Array of recurring charge objects
 */
export const getRecurringCharges = async (userId) => {
  try {
    const chargesRef = collection(db, 'users', userId, COLLECTION_NAME);
    const q = query(chargesRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const charges = [];
    querySnapshot.forEach((doc) => {
      charges.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return charges;
  } catch (error) {
    console.error('Error getting recurring charges:', error);
    throw new Error('Failed to fetch recurring charges');
  }
};

/**
 * Add a new recurring charge
 * 
 * @param {string} userId - The user's UID
 * @param {Object} chargeData - The recurring charge data
 * @returns {Promise<string>} The ID of the created charge
 */
export const addRecurringCharge = async (userId, chargeData) => {
  try {
    const chargesRef = collection(db, 'users', userId, COLLECTION_NAME);
    
    const newCharge = {
      ...chargeData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(chargesRef, newCharge);
    return docRef.id;
  } catch (error) {
    console.error('Error adding recurring charge:', error);
    throw new Error('Failed to add recurring charge');
  }
};

/**
 * Update an existing recurring charge
 * 
 * @param {string} userId - The user's UID
 * @param {string} chargeId - The charge document ID
 * @param {Object} chargeData - The updated charge data
 * @returns {Promise<void>}
 */
export const updateRecurringCharge = async (userId, chargeId, chargeData) => {
  try {
    const chargeRef = doc(db, 'users', userId, COLLECTION_NAME, chargeId);
    
    const updatedCharge = {
      ...chargeData,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(chargeRef, updatedCharge);
  } catch (error) {
    console.error('Error updating recurring charge:', error);
    throw new Error('Failed to update recurring charge');
  }
};

/**
 * Delete a recurring charge
 * 
 * @param {string} userId - The user's UID
 * @param {string} chargeId - The charge document ID
 * @returns {Promise<void>}
 */
export const deleteRecurringCharge = async (userId, chargeId) => {
  try {
    const chargeRef = doc(db, 'users', userId, COLLECTION_NAME, chargeId);
    await deleteDoc(chargeRef);
  } catch (error) {
    console.error('Error deleting recurring charge:', error);
    throw new Error('Failed to delete recurring charge');
  }
};

/**
 * Get active recurring charges for a user
 * 
 * @param {string} userId - The user's UID
 * @returns {Promise<Array>} Array of active recurring charge objects
 */
export const getActiveRecurringCharges = async (userId) => {
  try {
    const chargesRef = collection(db, 'users', userId, COLLECTION_NAME);
    const q = query(
      chargesRef, 
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const charges = [];
    querySnapshot.forEach((doc) => {
      charges.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return charges;
  } catch (error) {
    console.error('Error getting active recurring charges:', error);
    throw new Error('Failed to fetch active recurring charges');
  }
};

/**
 * Calculate total monthly cost of all active recurring charges
 * 
 * @param {Array} charges - Array of recurring charge objects
 * @returns {number} Total monthly cost
 */
export const calculateMonthlyTotal = (charges) => {
  const multipliers = {
    daily: 30,
    weekly: 4.33,
    biweekly: 2.17,
    monthly: 1,
    quarterly: 0.33,
    semiannually: 0.167,
    yearly: 0.083
  };

  return charges
    .filter(charge => charge.isActive)
    .reduce((total, charge) => {
      const monthlyAmount = charge.amount * (multipliers[charge.frequency] || 1);
      return total + monthlyAmount;
    }, 0);
};

/**
 * Get recurring charges by category
 * 
 * @param {string} userId - The user's UID
 * @param {string} category - The category to filter by
 * @returns {Promise<Array>} Array of recurring charge objects in that category
 */
export const getRecurringChargesByCategory = async (userId, category) => {
  try {
    const chargesRef = collection(db, 'users', userId, COLLECTION_NAME);
    const q = query(
      chargesRef,
      where('category', '==', category),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const charges = [];
    querySnapshot.forEach((doc) => {
      charges.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return charges;
  } catch (error) {
    console.error('Error getting recurring charges by category:', error);
    throw new Error('Failed to fetch recurring charges by category');
  }
};
