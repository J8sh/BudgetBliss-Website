# Firebase Authentication Setup Guide

Congratulations! Your authentication system is ready to use. Follow these steps to get started:

## 🎯 Quick Start

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `BudgetBliss` (or your preferred name)
4. Disable Google Analytics (optional for now)
5. Click **"Create project"**

### Step 2: Register Your Web App

1. In your Firebase project, click the **Web icon (</>) ** to add a web app
2. Give it a nickname: `BudgetBliss Web App`
3. Don't enable Firebase Hosting yet
4. Click **"Register app"**
5. **Copy the firebaseConfig object** - you'll need this!

### Step 3: Enable Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click **"Get started"**
3. Click on **"Email/Password"** under Sign-in providers
4. Toggle **"Enable"**
5. Click **"Save"**

### Step 4: Set Up Firestore Database

1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click **"Create database"**
3. Select **"Start in test mode"** (for development)
4. Choose your preferred location
5. Click **"Enable"**

⚠️ **Important**: Test mode allows anyone to read/write. Change security rules before going to production!

### Step 5: Configure Your App

1. In your project, create a `.env.local` file in the root directory:
   ```
   cp .env.example .env.local
   ```

2. Open `.env.local` and replace the placeholder values with your Firebase credentials:
   ```env
   REACT_APP_FIREBASE_API_KEY=AIzaSyC...
   REACT_APP_FIREBASE_AUTH_DOMAIN=budgetbliss-xxxxx.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=budgetbliss-xxxxx
   REACT_APP_FIREBASE_STORAGE_BUCKET=budgetbliss-xxxxx.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=1:123456789:web:xxxxx
   ```

3. Save the file

### Step 6: Start Your App

```bash
npm start
```

Your app will open at `http://localhost:3000` with the login page ready!

## ✨ What You Can Do Now

- **Sign Up**: Create a new account with email and password
- **Log In**: Sign in with your credentials
- **Log Out**: Click on your email in the header and select "Logout"

## 📱 Features Implemented

✅ User Registration (Sign Up)
✅ User Login
✅ User Logout
✅ Protected Routes (only logged-in users see the dashboard)
✅ Persistent Sessions (stays logged in after refresh)
✅ Error Handling (invalid credentials, weak passwords, etc.)
✅ Responsive Design (works on mobile and desktop)

## 🔒 Security Notes

### For Development (Current Setup):
- Test mode allows any authenticated user to read/write
- Perfect for learning and building features

### For Production (Before Launch):
Update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🐛 Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Make sure `.env.local` exists and has the correct values
- Restart your development server after creating `.env.local`

### "Firebase: Error (auth/invalid-api-key)"
- Double-check your API key in `.env.local`
- Make sure there are no extra spaces or quotes

### "Firebase: Error (auth/network-request-failed)"
- Check your internet connection
- Verify Firebase project is active in the console

## 📚 Next Steps

Now that authentication is working, you can:
1. Build the spending tracker feature
2. Add transaction management
3. Create data visualizations
4. Implement budgets and categories

## 🎉 You're All Set!

Your authentication system is production-ready. Users can now sign up, log in, and their sessions persist across page refreshes. Happy coding!
