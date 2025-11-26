# Google Sign-In Setup Guide

Follow these steps to enable Google Sign-In for your BudgetBliss app.

## 📋 Prerequisites

- Firebase project created (`budgetbliss-64011`)
- Email/Password authentication already enabled

## 🔧 Enable Google Sign-In in Firebase Console

### Step 1: Navigate to Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `budgetbliss-64011`
3. Click **"Build"** → **"Authentication"** in the left sidebar
4. Click on the **"Sign-in method"** tab

### Step 2: Enable Google Provider

1. Find **"Google"** in the list of sign-in providers
2. Click on it
3. Toggle the **"Enable"** switch
4. **Project support email**: Enter your email (required)
5. Click **"Save"**

That's it! Google Sign-In is now enabled.

## ✅ Testing

### On Your Local Development Server

1. Make sure your app is running: `npm start`
2. Navigate to the login or signup page
3. Click the **"Continue with Google"** button
4. A popup will appear asking you to select your Google account
5. Choose an account and authorize the app
6. You'll be automatically logged in! 🎉

### Expected Flow

1. **Click "Continue with Google"**
2. **Google popup appears** with account selection
3. **Select your Google account**
4. **Grant permissions** (first time only)
5. **Redirected to dashboard** - you're logged in!

## 🎨 What You Got

✅ **One-Click Login** - Users can sign in instantly with Google
✅ **Secure Authentication** - Google handles password security
✅ **Better UX** - No need to remember another password
✅ **Auto Account Creation** - New users are automatically registered
✅ **Profile Info** - Access to user's name, email, and profile picture

## 🔒 Security Notes

### Development (Current)
- Works on `localhost` automatically
- No additional configuration needed

### Production (Before Deployment)
You'll need to add your production domain to authorized domains:

1. Firebase Console → Authentication → Settings → Authorized domains
2. Click **"Add domain"**
3. Enter your production domain (e.g., `budgetbliss.com`)
4. Click **"Add"**

## 🐛 Troubleshooting

### "Pop-up blocked" Error
- **Solution**: Allow pop-ups for `localhost:3000` in your browser
- Chrome: Click the icon in the address bar and select "Always allow"

### "Popup closed by user"
- **Not an error**: User cancelled the sign-in
- App handles this gracefully with a message

### "auth/unauthorized-domain"
- **Cause**: Your domain isn't authorized in Firebase
- **Solution**: Add domain in Firebase Console → Authentication → Settings → Authorized domains

## 💡 User Experience

### For New Users
- Click "Continue with Google"
- Account is automatically created
- Logged in immediately

### For Existing Users
- Click "Continue with Google"
- Instantly logged in
- No password required

### User Profile Access
You now have access to:
- `currentUser.displayName` - User's full name
- `currentUser.email` - User's email
- `currentUser.photoURL` - User's profile picture
- `currentUser.uid` - Unique user ID

You can use these to personalize the dashboard!

## 🎉 You're All Set!

Users can now sign in with Google in addition to email/password. The experience is seamless and secure!

**Next Steps:**
- Test Google Sign-In on your app
- Add user profile display in the header
- Build the spending tracker features
