# Recurring Charges Module

## Overview
The Recurring Charges module is a feature of BudgetBliss that allows users to track and manage their recurring expenses like subscriptions, bills, and regular payments.

## Features

### ✅ Add Recurring Charges
- **Name**: Custom name for the charge (e.g., "Netflix Subscription")
- **Amount**: Dollar amount of the charge
- **Frequency**: How often it recurs
  - Daily
  - Weekly
  - Bi-weekly
  - Monthly
  - Quarterly
  - Yearly
- **Category**: Type of expense
  - Utilities
  - Subscriptions
  - Insurance
  - Rent/Mortgage
  - Loan Payment
  - Memberships
  - Services
  - Other
- **Start Date**: When the charge begins
- **End Date**: Optional end date for time-limited charges
- **Active Status**: Toggle to pause/resume a charge
- **Notes**: Additional details about the charge

### 📊 View & Organize
- **Summary Dashboard**: See total active charges and monthly/yearly costs
- **Category Grouping**: Charges organized by category with icons
- **Monthly Equivalent**: Automatic calculation of monthly cost for all frequencies
- **Card Layout**: Clean, modern card design for each charge

### ✏️ Edit & Delete
- **Edit**: Update any charge details
- **Delete**: Remove charges with confirmation
- **Pause**: Temporarily disable charges without deleting

## Technical Implementation

### Components
```
src/features/recurring/
├── RecurringCharges.jsx       # Main container component
├── RecurringCharges.css       # Main component styles
├── AddRecurringCharge.jsx     # Form for adding/editing charges
├── AddRecurringCharge.css     # Form styles
├── RecurringChargeList.jsx    # Display list of charges
└── RecurringChargeList.css    # List styles
```

### Services
```
src/services/
└── recurringChargesService.js # Firestore CRUD operations
```

### Data Structure
Charges are stored in Firestore under:
```
/users/{userId}/recurringCharges/{chargeId}
```

Each charge document contains:
```javascript
{
  name: string,
  amount: number,
  frequency: string,
  category: string,
  startDate: string (ISO format),
  endDate: string (ISO format, optional),
  isActive: boolean,
  notes: string (optional),
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Usage

### For Users
1. **Adding a Charge**:
   - Click "Add Recurring Charge" button
   - Fill in the form with charge details
   - Click "Add Charge" to save

2. **Editing a Charge**:
   - Click "Edit" on any charge card
   - Update the form fields
   - Click "Update Charge" to save changes

3. **Deleting a Charge**:
   - Click "Delete" on any charge card
   - Confirm deletion in the popup

4. **Pausing a Charge**:
   - Edit the charge
   - Uncheck "Active" checkbox
   - Save changes

### For Developers

#### Import the Component
```javascript
import RecurringCharges from './features/recurring/RecurringCharges';
```

#### Use in Dashboard
```javascript
<RecurringCharges />
```

#### Firestore Security Rules
Add these rules to protect user data:
```javascript
match /users/{userId}/recurringCharges/{chargeId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## Calculations

### Monthly Equivalent
The system calculates monthly equivalents using these multipliers:
- **Daily**: × 30
- **Weekly**: × 4.33
- **Bi-weekly**: × 2.17
- **Monthly**: × 1
- **Quarterly**: × 0.33 (÷ 3)
- **Yearly**: × 0.083 (÷ 12)

Example: A $9.99 yearly subscription = $9.99 × 0.083 = $0.83/month

### Yearly Total
Monthly equivalent × 12

## Design Principles

### Accessibility
- ✅ Semantic HTML elements
- ✅ ARIA labels for screen readers
- ✅ Keyboard navigation support
- ✅ Focus states on interactive elements
- ✅ Color contrast compliance

### Responsive Design
- **Desktop** (1024px+): Multi-column grid layout
- **Tablet** (768px-1023px): Adjusted grid
- **Mobile** (< 768px): Single column layout

### User Experience
- Visual feedback on hover/click
- Loading states during operations
- Error handling with user-friendly messages
- Confirmation dialogs for destructive actions
- Smooth animations and transitions

## Future Enhancements

### Potential Features
- [ ] Due date reminders
- [ ] Payment history tracking
- [ ] Charts and visualizations
- [ ] Budget alerts when charges exceed limits
- [ ] Export to CSV/PDF
- [ ] Recurring charge templates
- [ ] Auto-payment tracking
- [ ] Cost comparison tools

### Integration Opportunities
- [ ] Link to transaction history
- [ ] Budget allocation
- [ ] Financial forecasting
- [ ] Calendar integration
- [ ] Email/SMS notifications

## Troubleshooting

### Common Issues

**Charges not loading**
- Check Firebase configuration
- Verify user is authenticated
- Check browser console for errors
- Ensure Firestore rules allow access

**Can't add charges**
- Verify all required fields are filled
- Check amount is greater than 0
- Ensure start date is valid
- Check Firestore write permissions

**Styling issues**
- Clear browser cache
- Check CSS files are imported
- Verify no conflicting styles
- Test in different browsers

## Testing

### Manual Testing Checklist
- [ ] Add a new recurring charge
- [ ] Edit an existing charge
- [ ] Delete a charge
- [ ] Pause/unpause a charge
- [ ] Test all frequency types
- [ ] Test all categories
- [ ] Verify monthly calculations
- [ ] Test responsive design
- [ ] Test form validation
- [ ] Test error handling

## Support
For issues or questions, please refer to the main BudgetBliss documentation or create an issue on GitHub.

---
Built with ❤️ for BudgetBliss users
